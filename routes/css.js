var async = require('async');
var uglify = require('uglifycss');
var grouplib = require('../groups');

function load(groups, group, cb)
{
  var files;
  if ( !groups[group] )
    return cb(new Error('Unknown CSS group: '+ group));

  async.map(groups[group].css || [], loadSource, filesLoaded);

  function loadSource(name, cb) {
    grouplib.loadSource(groups, 'css', name, cb);
  }

  function filesLoaded(err, res) {
    if ( err )
      return cb(err);

    cb(null, res||[]);
  }
}

function fetch(groups, group, opt, cb) {
  load(groups, group, function(err, sources) {
    if ( err )
      return cb(err);

    cb(null, sources.join("\n\n"));
  });
}

function fetchMin(groups, group, opt, cb) {
  load(groups, group, function(err, sources) {
    if ( err )
      return cb(err)

    async.map(sources, minify, minified)
  });

  function minified(err, minifiedSources)
  {
    cb(null,minifiedSources.join("\n\n"));
  };
}

function minify(source, cb)
{
  process.nextTick(function() { 
    var min = uglify.processString(source);
    cb(undefined,min);
  });
}

function respond(err, src)
{
  var res = this;
  if ( err )
    return res.send(err.toString());

  res.header('Content-Type','text/css;charset=UTF-8');
  res.end(src);
}


exports.fetch = fetch;
exports.fetchMin = fetchMin;

exports.serve = function(groups, group, opt, req, res)
{
  fetch(groups, group, opt, respond.bind(res));
};

exports.serveMin = function(groups, group, opt, req, res)
{
  fetchMin(groups, group, opt, respond.bind(res));
};

