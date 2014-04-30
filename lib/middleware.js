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

console.log(opt);
  // Handler files (js, css, view)
  app.use(opt.prefix, function serveAsset(req, res, next) {
    var parse = urllib.parse(req.url);
    var file = parse.pathname.substr(1);

    console.log('serveAsset',file);
    var match = file.match(/(.*?)(\.min)?\.([^\.]+)$/i);
    if ( !match )
      return next();

    console.log('match',match);
    var name = match[1];
    var min = match[2] ? true : false;
    var type = match[3].toLowerCase();
    var fn = (min ? 'serveMin' : 'serve');

    console.log('name',name,'min',min,'type',type,'fn',fn);
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
      app.use(opt.prefix + key, express.static(config.staticFileDirs[key], {maxAge: opt.maxAge}));
    });
  }

  return app;
}

module.exports = register;
