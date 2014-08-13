var async = require('async');
var fs = require('graceful-fs');
var UglifyJS = require('uglify-js');
var util = require('util');
var handlebars = require('hbs').handlebars;
var ember = null;
var vm = require('vm');
var config = require('../config');

function _load(group, opt, cb)
{
  async.series([
    function(cb) { async.mapLimit(group.js   || [], 5, _readJs, cb); },
    function(cb) { async.mapLimit(group.hbs  || [], 5, _readHbs, cb); },
    function(cb) { async.mapLimit(group.view || [], 5, _readHbs, cb); },
  ], done);

  function _readJs(labelAndPath, cb)
  {
    fs.readFile(config.filePath(labelAndPath), 'utf8', function(err, src) {
      if ( err )
        return void cb(err);

      cb(null,{label: config.fileLabel(labelAndPath), src: src});
    });
  }

  function _readHbs(labelAndPath, cb)
  {
    fs.readFile(config.filePath(labelAndPath), 'utf8', function(err, source) {
      if ( err )
        return void cb(err);

      var label = (opt.templatePrefix||'')+config.fileLabel(labelAndPath);
      _compileHbs(label, source, opt, function(err, src) {
        if ( err )
          return void cb(err);

        cb(null,{label: label, src: src});
      });
    });
  }

  function done(err, res) {
    if ( err )
      return cb(err);

    var sources = [];
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

function _minify(sources, opt, cb)
{
  var ast = null;

  if ( !sources || (util.isArray(sources) && sources.length == 0) )
  {
    process.nextTick(function() {
      cb(null,'');
    });
    return
  }

  if ( !util.isArray(sources) )
    sources = [sources];

  try {
    sources.forEach(function(file) {
      ast = UglifyJS.parse(file.src, {
        filename: file.label,
        toplevel: ast
      });
    });

    ast.figure_out_scope();

    var config = {warnings: false};
    var in_opt = opt.jsmin || {};
    var k = Object.keys(in_opt);
    for ( var i = 0, len = k.length ; i < len ; i++ )
    {
      config[ k[i] ] = in_opt[ k[i] ];
    }

    var compressor = UglifyJS.Compressor(config)
    var compressedAst = ast.transform(compressor);

    compressedAst.figure_out_scope();
    compressedAst.compute_char_frequency();
    compressedAst.mangle_names();

/*
    var sourceMap = UglifyJS.SourceMap({
      file: opt.minFileName
    });
*/
    var stream = UglifyJS.OutputStream({
//      source_map: sourceMap,
    });
    compressedAst.print(stream);

    var min = stream.toString();
//    var map = sourceMap.toString();
  }
  catch (e)
  {
    console.log(e);
    throw e;
  }

  process.nextTick(function () { cb(null, min/*, map*/); });
}

function fetch(group, groupName, opt, cb)
{
  _load(group, opt, function(err, sources) {
    if ( err )
      return cb(err)

    var out = '';
    sources.forEach(function(file) {
      out += '// ' + file.label + '\n' + file.src + ';\n\n';
    });

    cb(null, out);
  });
}

function fetchMin(group, groupName, opt, cb)
{
  _load(group, opt, function(err, sources) {
    if ( err )
      return cb(err)

    opt.minFileName = groupName+'.min.js';
    _minify(sources, opt, cb);

/*
    async.map(sources, function(file, cb) {
      _minify(file, opt, function(err, src, map) {
        cb(err,src);
      });
    }, done);

    function done(err,src) {
      console.log(err,src);
      cb(err,src.join(';\n\n'));
    }
*/
  });
}

function fetchMap(group, groupName, opt, cb) {
  fetchMin(group, groupName, opt, function(err, src, map) {
    cb(err,map);
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
//    res.setHeader('X-SourceMap',groupName+'.min.js.map');
    _respond(res, err, src);
  });
}

function serveMap(group, groupName, opt, req, res) {
  fetchMap(group, groupName, opt, function(err, src) {
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
exports.fetchMap = fetchMap;
exports.serve = serve;
exports.serveMin = serveMin;
exports.serveMap = serveMap;
