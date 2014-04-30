var async = require('async');
var fs = require('graceful-fs');
var UglifyJS = require('uglify-js');
var util = require('util');
var handlebars = require('handlebars');
var ember = null;
var vm = require('vm');
var groups = require('../groups');

function _load(group, opt, cb)
{
  var sources = [];
  async.series([
    function(cb) { async.map(group.js   || [], _readJs, cb); },
    function(cb) { async.map(group.hbs  || [], _readHbs, cb); },
    function(cb) { async.map(group.view || [], _readHbs, cb); },

  ], done);

  function _readJs(labelAndPath, cb)
  {
    fs.readFile(groups.filePath(labelAndPath), 'utf8', cb);
  }

  function _readHbs(labelAndPath, cb)
  {
    fs.readFile(groups.filePath(labelAndPath), 'utf8', function(err, source) {
      if ( err )
        return void cb(err);

      _compileHbs(groups.fileLabel(labelAndPath), source, opt, cb);
    });
  }

  function done(err, res) {
    if ( err )
      return cb(err);

    for ( var i = 0 ; i < res.length ; i++ )
    {
      sources = sources.concat(res[i]);
    }

    cb(null, sources);
  }
}

function _compileHbs(name, source, opt, cb)
{
  var handlebarVar = opt.handlebarVar || "Handlebars";
  var container = opt.templateVar || "Handlebars.templates";
  var safeName = name.replace(/'/g,"\\'");
  var useEmber = opt.emberViews === true;

  process.nextTick(function() {
    var compiled;
    if ( useEmber )
      compiled = _precompileEmber(source, opt);
    else
      compiled = _precompileHandlebar(source, opt);

    var out = [
      "(function(handlebars, container, name, compiled) {"    ,
      "  container = [].concat(container);"                   ,
      "  var tpl = handlebars.template(compiled,{});"         ,
      "  for ( var i = 0 ; i < container.length ; i++ ) {"    ,
      "    container[i][name] = tpl;"                         ,
      "  }"                                                   ,
      "  handlebars.registerPartial(name, tpl);"              ,
      "})("                                                   ,
      "  "+ handlebarVar +","                                 ,
      "  "+ container +","                                    ,
      "  '"+ safeName + "',"                                  ,
      "  "+ compiled                                          ,
      ");"
    ];

    cb(null, out.join("\n"));
  });
}

function _precompileHandlebar(source, opt)
{
  var compiled = handlebars.precompile(source,{});
  return compiled;
}

// Provide mock versions of all the things Ember requires to compile templates
var contextCache = {};
function _getContext(opt)
{
  var handlebarsPath = opt.handlebarsPath || null;
  if ( !handlebarsPath )
    throw new Error('handlebarsPath not specified');

  var emberPath = opt.emberPath || null;
  if ( !emberPath )
    throw new Error('emberPath not specified');

  var key = emberPath+'|'+handlebarsPath;
  var ctx = contextCache[key];
  if ( !ctx )
  {
    var handlebarsSrc = fs.readFileSync(handlebarsPath,'utf8');
    var emberSrc = fs.readFileSync(emberPath,'utf8');

    // Yes.. we totally have the jQuery
    var jQuery = function() { return jQuery; };
    jQuery.ready = jQuery;
    jQuery.inArray = jQuery;
    jQuery.jquery = "1.8.3";
    jQuery.event = { fixHooks: {} };

    var element = {
      firstChild: function () { return element; },
      innerHTML: function () { return element; },
      childNodes: [{}],
      appendChild: function() {},
      setAttribute: function() {}
    }

    var sandbox = {
      console: console,
      jQuery: jQuery,
      $: jQuery,
      document: {
        createRange: false,
        createElement: function() { return element; },
      },
      navigator: {
        userAgent: '',
      },
      compiled: null,
    };
    sandbox.window = sandbox;

    ctx = contextCache[key] = vm.createContext(sandbox);
    vm.runInContext(handlebarsSrc, ctx, 'handlebars.js');
    vm.runInContext(emberSrc, ctx, 'ember.js');
  }

  return ctx;
}

function _precompileEmber(source, opt)
{
  var ctx = _getContext(opt);
  ctx.template = source.toString();
  vm.runInContext('compiled = Ember.Handlebars.precompile(template).toString();', ctx);
  return ctx.compiled;
}

function _minify(source, opt, cb)
{
  try {
    var ast = UglifyJS.parse(source);
    ast.figure_out_scope();

    var config = {warnings: false};
    var in_opt = opt.jsmin || {};
    var k = Object.keys(in_opt);
    for ( var i = 0, len = k.length ; i < len ; i++ )
    {
      config[ k[i] ] = in_opt[ k[i] ];
    }

    var compressor = UglifyJS.Compressor(config)
    ast = ast.transform(compressor);

    ast.figure_out_scope();
    ast.compute_char_frequency();
    ast.mangle_names();

    var min = ast.print_to_string();
  }
  catch (e)
  {
    console.log(e);
    throw e;
  }

  process.nextTick(function () { cb(undefined,min); });
}

function fetch(group, groupName, opt, cb)
{
  _load(group, opt, function(err, sources) {
    if ( err )
      return cb(err)

    cb(null, sources.join(";\n\n"));
  });
}

function fetchMin(group, groupName, opt, cb)
{
  fetch(group, groupName, opt, function(err, source) {
    if ( err )
      return void cb(err);

    _minify(source, opt, cb);
  });
}

function serve(group, groupName, opt, req, res)
{
  fetch(group, groupName, opt, function(err, src) {
    _respond(res, err, src);
  });
}

function serveMin(group, groupName, opt, req, res)
{
  fetchMin(group, groupName, opt, function(err, src) {
    _respond(res, err, src);
  });
}

function _respond(res, err, src)
{
  if ( err )
  {
    return res.send(500, err.toString());
  }

  res.header('Content-Type','text/javascript;charset=UTF-8');
  res.end(src);
}


exports.fetch = fetch;
exports.fetchMin = fetchMin;
exports.serve = serve;
exports.serveMin = serveMin;
