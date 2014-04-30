var express = require('express');
var http = require('http');
var path = require('path');

function server(config, pkg, port)
{
  var app = express();

  app.set('port', process.env.PORT || port || 3000);
  app.set('views', __dirname + '/../view');
  app.set('view engine', 'hbs');
  app.use(express.favicon());
  app.use(express.compress());
  app.use(express.logger());
  app.use(express.bodyParser());
  app.use(express.errorHandler());
  app.use(app.router);

  app.get('/', function(req, res) {
    var groupNames = [];

    var keys = Object.keys(config.groups);
    keys.forEach(function(key) {
      console.log('Save Output:',key,config.groups[key],config.groups[key].saveOutput!==false);
      if ( config.groups[key].saveOutput !== false )
        groupNames.push(key);
    });

    res.render('index', {title: 'Assets', groupNames: groupNames, version: pkg.version});
  });

  var middleware = require('./middleware.js');
  middleware(app, config);

  http.createServer(app).listen(app.get('port'), function() {
    console.log("Asset server listening on port " + app.get('port'));
  });

  return {app: app, server: server};
}

module.exports = server;
