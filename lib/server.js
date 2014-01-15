var express = require('express');
var http = require('http');
var path = require('path');

function server(groups, pkg, port)
{
  var app = express();

  app.configure(function() {
    app.set('port', process.env.PORT || port || 3000);
    app.set('views', __dirname + '/../view');
    app.set('view engine', 'hbs');
    app.use(express.favicon());
    app.use(express.compress());
    app.use(express.logger());
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
  });

  app.configure('development', function() {
    app.use(express.errorHandler());
  });

  app.get('/', function(req, res) {
    var groupNames = [];
    var keys = Object.keys(groups);
    for ( var i = 0 ; i < keys.length ; i++ )
    {
      if ( keys[i].substr(0,1) != '_' )
      {
        groupNames.push(keys[i]);
      }
    }

    res.render('index', {title: 'Assets', groupNames: groupNames, version: pkg.version});
  });

  var middleware = require('./middleware.js');
  middleware(app, groups);

  http.createServer(app).listen(app.get('port'), function() {
    console.log("Asset server listening on port " + app.get('port'));
  });

  return {app: app, server: server};
}

module.exports = server;
