var express = require('express');
var util = require('util');
var urllib = require('url');

var dynamic = {
  css: require('./routes/css'),
  js: require('./routes/js')
};

function register(app, groups, opt)
{
  opt = opt || {};
  opt.prefix = opt.prefix || '';

  opt.prefix = opt.prefix.replace(/\/$/,'')+'/';

  var keys = Object.keys(groups);
  app.use(opt.prefix, function serveAsset(req, res, next) {
    var parse = urllib.parse(req.url);
    var file = parse.pathname.substr(1);

    var match = file.match(/(.*?)(\.min)?\.([^\.]+)$/i);
    if ( !match )
      return next();

    var name = match[1];
    var min = match[2] ? true : false;
    var type = match[3].toLowerCase();
    var fn = (min ? 'serveMin' : 'serve');

    if ( !dynamic[type] )
      return next();

    if ( !groups[name] )
      return next();

    dynamic[type][fn](groups, name, opt, req, res);
  });

  // @TODO optimize into one handler instead of one app.use per path
  keys = Object.keys(groups._paths);
  for ( i = 0 ; i < keys.length ; i++ )
  {
    key = keys[i];

    if ( ['js','css','view'].indexOf(key) >= 0 )
      continue;

    if ( !util.isArray(groups._paths[key]) )
      groups._paths[key] = [ groups._paths[key] ];

    var path;
    for ( var j = 0 ; j < groups._paths[key].length ; j++ )
    {
      path = groups._paths[key][j];
      if ( !path )
        continue;

      app.use((key == 'root' ? '/' : opt.prefix+key), express.static(path));
    }
  }

  return app;
}

module.exports = register;
