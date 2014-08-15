var express = require('express');
var util = require('util');
var urllib = require('url');
var handlers = require('./handlers');

function register(app, config, opt)
{
  if ( arguments.length == 2 )
  {
    // register(config,opt)
    opt = config;
    config = app;
    app = null;

    // For express4, register(config, {rootRouter: x, router: y})
  }

  // Set default options
  opt = opt || {};
  opt.prefix = opt.prefix || '';
  opt.rootPrefix = opt.rootPrefix || '/';

  // Normalize paths
  opt.prefix = opt.prefix.replace(/\/$/,'')+'/';
  opt.rootPrefix = opt.rootPrefix.replace(/\/$/,'')+'/';

  if ( typeof opt.maxAge === 'undefined' )
  {
    opt.maxAge = 1000;
  }

  var router = opt.router || app;
  if ( !router )
  {
    throw new Error('You must pass in app or specify a router object in options');
  }

  // Handler files (js, css, view)
  router.use(opt.prefix, function serveAsset(req, res, next) {
    res.header('Access-Control-Allow-Origin','*');
    var parse = urllib.parse(req.url);
    var file = parse.pathname.substr(1);

    var match = file.match(/(.*?)(\.min)?\.([^\.]+)(\.map)?$/i);
    if ( !match )
      return next();

    var name = match[1];
    var min = match[2] ? true : false;
    var type = match[3].toLowerCase();
    var map = match[4] ? true : false;

    var fn;
    if ( min && map)
    {
      fn = 'serveMap';
    }
    else if ( min )
    {
      fn = 'serveMin';
    }
    else
    {
      fn = 'serve';
    }

    if ( !handlers[type] || !config.groups[name] )
    {
      return next();
    }

    handlers[type][fn](config.groups[name], name, opt, req, res);
  });

  // Static Files
  if ( config.staticFileDirs )
  {
    var keys = Object.keys(config.staticFileDirs)
    keys.forEach(function(key) {
      config.staticFileDirs[key].forEach(function(path) {
        router.use(opt.prefix + key, express.static(path, {maxAge: opt.maxAge}));
      });
    });
  }

  // Root files
  if ( config.rootFileDirs && config.rootFileDirs.length )
  {
    var rootRouter = opt.rootRouter || app;
    if ( !rootRouter )
    {
      throw new Error('You must pass in app or specify a rootRouter object in options to use rootFileDirs');
    }

    config.rootFileDirs.forEach(function(path) {
      rootRouter.use(opt.rootPrefix, express.static(path, {maxAge: opt.maxAge}));
    });
  }

  return app;
}

module.exports = register;
