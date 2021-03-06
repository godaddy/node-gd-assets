var async = require('async');
var uglify = require('uglifycss');
var fs = require('graceful-fs');
var config = require('../config');

function _load(group, groupName, cb)
{
  async.mapLimit(group.css || [], 5, _readFile, done);

  function _readFile(labelAndPath, cb)
  {
    fs.readFile(config.filePath(labelAndPath), 'utf8', cb);
  }

  function done(err, res) {
    if ( err )
      return cb(err);

    cb(null, res||[]);
  }
}

function _minify(source, cb)
{
  process.nextTick(function() { 
    var min = uglify.processString(source);
    cb(undefined,min);
  });
}

function fetch(group, groupName, opt, cb) {
  _load(group, groupName, function(err, sources) {
    if ( err )
      return cb(err);

    cb(null, sources.join("\n\n"));
  });
}

function fetchMin(group, groupName, opt, cb)
{
  fetch(group, groupName, opt, function(err, source) {
    if ( err )
      return void cb(err);

    _minify(source, cb);
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

  res.header('Content-Type','text/css;charset=UTF-8');
  res.end(src);
}


exports.fetch = fetch;
exports.fetchMin = fetchMin;
exports.serve = serve;
exports.serveMin = serveMin;
