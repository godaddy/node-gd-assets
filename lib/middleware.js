var express = require('express');
var util = require('util');
var urllib = require('url');
var handlers = require('./handlers');

function register(app, config, opt)
{
  var keys;

  opt = opt || {};
  opt.prefix = opt.prefix || '';
  opt.rootPrefix = opt.rootPrefix || '/';

  opt.prefix = opt.prefix.replace(/\/$/,'')+'/';
  opt.rootPrefix = opt.rootPrefix.replace(/\/$/,'')+'/';

  if ( typeof opt.maxAge === 'undefined' )
    opt.maxAge = 1000;

  // Handler files (js, css, view)
  app.use(opt.prefix, function serveAsset(req, res, next) {
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

    if ( !handlers[type] )
      return next();

    if ( !config.groups[name] )
      return next();

    handlers[type][fn](config.groups[name], name, opt, req, res);
  });

  // Root files
  if ( config.rootFileDirs && config.rootFileDirs.length )
  {
    config.rootFileDirs.forEach(function(path) {
      app.use(opt.rootPrefix, express.static(path, {maxAge: opt.maxAge}));
    });
  }

  // Static Files
  if ( config.staticFileDirs )
  {
    keys = Object.keys(config.staticFileDirs)
    keys.forEach(function(key) {
      config.staticFileDirs[key].forEach(function(path) {
        app.use(opt.prefix + key, express.static(path, {maxAge: opt.maxAge}));
      });
    });
  }

  return app;
}

module.exports = register;
