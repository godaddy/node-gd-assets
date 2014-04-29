var async = require('async');
var uglify = require('uglifycss');
var grouplib = require('./groups');

function _load(groups, groupName, cb)
{
  var files;
  if ( !groups[groupName] )
    return cb(new Error('Unknown CSS group: '+ groupName));

  async.map(groups[groupName].css || [], loadSource, filesLoaded);

  function loadSource(name, cb) {
    grouplib.loadSource(groups, 'css', name, cb);
  }

  function filesLoaded(err, res) {
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

function _respond(res, err, src)
{
  if ( err )
    return res.send(500, err.toString());

  res.header('Content-Type','text/css;charset=UTF-8');
  res.end(src);
}

function fetch(groups, groupName, opt, cb) {
  _loadSource(groups, groupName, function(err, sources) {
    if ( err )
      return cb(err);

    cb(null, sources.join("\n\n"));
  });
}

function fetchMin(groups, groupName, opt, cb)
{
  fetch(groups, groupName, opt, function(err, source) {
    if ( err )
      return void cb(err);

    _minify(source, cb);
  });
}

function serve(groups, groupName, opt, req, res)
{
  fetch(groups, groupName, opt, _respond.bind(res));
}

function serveMin(groups, groupName, opt, req, res)
{
  fetchMin(groups, groupName, opt, _respond.bind(res));
}


exports.fetch = fetch;
exports.fetchMin = fetchMin;

exports.serve = function(groups, groupName, opt, req, res)
{
  fetch(groups, groupName, opt, _respond.bind(res));
};

exports.serveMin = function(groups, groupName, opt, req, res)
{
  fetchMin(groups, groupName, opt, _respond.bind(res));
};

