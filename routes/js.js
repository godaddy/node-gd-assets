var async = require('async');
var fs = require('graceful-fs');
var UglifyJS = require('uglify-js');
var grouplib = require('../groups');
var util = require('util');
var handlebars = require('handlebars');
var ember = null;
var vm = require('vm');

function load(groups, group, opt, cb)
{
  if ( !groups[group] )
    return cb(new Error('Unknown JS group: '+ group));

  var sources = [];

  async.map(groups[group].js || [], loadJS, jsLoaded);

  function loadJS(name, cb)
  {
    grouplib.loadSource(groups,'js',name,cb);
  }

  function jsLoaded(err,res)
  {
    if ( err )
      return cb(err);

    sources = sources.concat(res);
    async.map(groups[group].view || [], loadView, filesLoaded);
  }

  function loadView(name, cb)
  {
    grouplib.loadSource(groups,'view',name, function(err, source) {
      if ( err )
        return cb(err);

      compileView((opt.tplPrefix||'')+name, source, opt, cb);
    });
  }

  function filesLoaded(err, res) {
    if ( err )
      return cb(err);

    sources = sources.concat(res);
    cb(null, sources);
  }
}

function fetch(groups, group, opt, cb)
{
  load(groups, group, opt, function(err, sources) {
    if ( err )
      return cb(err)

    cb(null, sources.join(";\n\n"));
  });
}

function fetchMin(groups, group, opt, cb)
{
  load(groups, group, opt, function(err, sources) {
    if ( err )
      return cb(err)

    async.map(sources, function(source,cb) { return minify(source,opt,cb); }, minified);
  });

  function minified(err, minifiedSources) {
    if ( err )
      return cb(err);

    cb(null, minifiedSources.join(";\n\n"));
  }
}

function compileView(name, source, opt, cb)
{
  var handlebarVar = opt.handlebarVar || "Handlebars";
  var containers = opt.templateVar || "Handlebars.templates";
  var safeName = name.replace(/'/g,"\\'");
  var useEmber = opt.emberViews === true;

  process.nextTick(function() {
    var compiled;
    if ( useEmber )
      compiled = _compileEmberView(source,opt);
    else
      compiled = _compileHandlebarView(source,opt);

    var out = [
      "(function(handlebars, containers, name, compiled) {"    ,
      "  containers = [].concat(containers);"                  ,
      "  var tpl = handlebars.template(compiled,{});"          ,
      "  for ( var i = 0 ; i < containers.length ; i++ ) {"    ,
      "    containers[i][name] = tpl;"                         ,
      "  }"                                                    ,
      "  handlebars.registerPartial(name, tpl);"               ,
      "})("                                                    ,
      "  "+ handlebarVar +","                                  ,
      "  "+ containers +","                                    ,
      "  '"+ safeName + "',"                                   ,
      "  "+ compiled                                           ,
      ");"
    ];

    cb(null, out.join("\n"));
  });
}

function _compileHandlebarView(source, opt)
{
  var compiled = handlebars.precompile(source,{});
  return compiled;
}

var emberSrc = null;
var handlebarsSrc = null;
function _compileEmberView(source, opt)
{
  var emberPath = opt.emberPath || null;
  if ( !emberPath )
    throw new Error('emberPath not specified');

  var handlebarsPath = opt.handlebarsPath || null;
  if ( !handlebarsPath )
    throw new Error('handlebarsPath not specified');

  if ( !handlebarsSrc )
    handlebarsSrc = fs.readFileSync(handlebarsPath,'utf8');

  if ( !emberSrc )
    emberSrc = fs.readFileSync(emberPath,'utf8');

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
    template: source.toString(),
    compiled: null,
  };
  sandbox.window = sandbox;

  var ctx = vm.createContext(sandbox);
  vm.runInContext(handlebarsSrc, ctx, 'handlebars.js');
  vm.runInContext(emberSrc, ctx, 'ember.js');
  vm.runInContext('compiled = Ember.Handlebars.precompile(template).toString();', ctx);

  return ctx.compiled;
}

function minify(source, opt, cb)
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
    return res.send(err.toString());
  }

  res.header('Content-Type','text/javascript;charset=UTF-8');
  res.end(src);
}


exports.fetch = fetch;
exports.fetchMin = fetchMin;

exports.serve = function(groups, group, opt, req, res){
  fetch(groups, group, opt, respond.bind(res));
};

exports.serveMin = function(groups, group, opt, req, res){
  fetchMin(groups, group, opt, respond.bind(res));
};

