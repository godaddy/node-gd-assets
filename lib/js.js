var async = require('async');
var fs = require('graceful-fs');
var UglifyJS = require('uglify-js');
var grouplib = require('./groups');
var util = require('util');
var handlebars = require('handlebars');
var ember = null;
var vm = require('vm');

function _load(groups, groupName, opt, cb)
{
  if ( !groups[groupName] )
    return cb(new Error('Unknown JS group: '+ groupName));

  var sources = [];
  async.series([
    function(cb) { async.map(groups[groupName].js   || [], _loadJs,  cb); },
    function(cb) { async.map(groups[groupName].hbs  || [], _loadHbs, cb); },
    function(cb) { async.map(groups[groupName].view || [], _loadHbs, cb); },

  ], done);

  function loadJS(name, cb)
  {
    grouplib.loadSource(groups, 'js', name, cb);
  }

  function loadHbs(name, cb)
  {
    console.log('loadHbs:',name);
    grouplib.loadSource(groups, 'hbs', name, function(err, source) {
      if ( err )
        return cb(err);

      compileHbs((opt.tplPrefix||'')+name, source, opt, cb);
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

function compileHbs(name, source, opt, cb)
{
  var handlebarVar = opt.handlebarVar || "Handlebars";
  var container = opt.templateVar || "Handlebars.templates";
  var safeName = name.replace(/'/g,"\\'");
  var useEmber = opt.emberViews === true;

  process.nextTick(function() {
    var compiled;
    if ( useEmber )
      compiled = _compileEmber(source, opt);
    else
      compiled = _compileHandlebar(source, opt);

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

function _compileHandlebar(source, opt)
{
  var compiled = handlebars.precompile(source,{});
  return compiled;
}

var contextCache = {};
function _contextFor()
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

function _compileEmber(source, opt)
{
  var ctx = _getContext();
  ctx.template = source.toString();
  vm.runInContext('compiled = Ember.Handlebars.precompile(template).toString();', ctx);
  return ctx.compiled;
}

function _minify(source, opt, cb)
{
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

  process.nextTick(function () { cb(undefined,min); });
}

function respond(err, src)
{
  var res = this;
  if ( err )
  {
    return res.send(500, err.toString());
  }

  res.header('Content-Type','text/javascript;charset=UTF-8');
  res.end(src);
}

function fetch(groups, groupName, opt, cb)
{
  _load(groups, groupName, opt, function(err, sources) {
    if ( err )
      return cb(err)

    cb(null, sources.join(";\n\n"));
  });
}

function fetchMin(groups, groupName, opt, cb)
{
  fetch(groups, groupName, opt, function(err, source) {
    if ( err )
      return void cb(err);

    _minify(source, opt, cb);
  });
}

function serve(groups, groupName, opt, req, res)
{
  fetch(groups, groupName, opt, respond.bind(res));
}

function serveMin(groups, groupName, opt, req, res)
{
  fetchMin(groups, groupName, opt, respond.bind(res));
}


exports.fetch = fetch;
exports.fetchMin = fetchMin;
exports.serve = serve;
exports.serveMin = serveMin;
