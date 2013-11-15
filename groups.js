var pathlib = require('path');
var util = require('util');
var fs = require('fs');
var async = require('async');

// Renamed from path.exists to fs.exists in Node 0.6
var _exists = (fs.exists || pathlib.exists);

var knownTypes, knownKeys;

function _getSetTypes(newTypes)
{
  if ( newTypes )
  {
    knownTypes = newTypes;
    knownKeys = Object.keys(knownTypes);
  }
  
  return knownTypes;
}

// Set the file extensions to look for.  Empty string will look for the exact filename
_getSetTypes({
  'js':     ['js',''],
  'css':    ['css',''],
  'view':   ['hbs','']
});

// Read a group definition JSON file and massage each group into
// a flat list of absolute paths for each resource required
function load(groupFile)
{
  var baseDir = pathlib.dirname(groupFile);
  var inputs = require(groupFile);
  var ret = {};

  // Default the paths to ./public if not specified,
  var paths = inputs._paths || {};
  delete inputs._paths;
  for ( var i = 0 ; i < knownKeys.length ; i++ )
  {
    var key = knownKeys[i];
    if ( !paths.hasOwnProperty(key) )
      paths[key] = ['./public/' + key];
  }

  // Resolve everything to arrays of absolute paths
  var keys = Object.keys(paths);
  for ( i = 0 ; i < keys.length; i++ )
  {
    key = keys[i];

    if ( !util.isArray(paths[key]) )
    {
      paths[key] = [ paths[key] ];
    }

    for ( var j = 0 ; j < paths[key].length ; j++ )
    {
      if ( paths[key][j] )
      {
        paths[key][j] = pathlib.resolve(baseDir, paths[key][j]);
      }
    }
  }

  ret._paths = paths;

  // Process each group into a flat list of files needed
  var groupNames = Object.keys(inputs);
  var name, input, flat;
  for ( var i = 0 ; i < groupNames.length ; i++ )
  {
    name = groupNames[i];
    flat = flatten(name,inputs);
    ret[name] = flat;
  }

  return ret;
}

// Flatten a single group into a list of files required for it
function flatten(name,groups,alreadySeen)
{
  alreadySeen = alreadySeen || [];

  var ret = {};
  var i;
  for ( i = 0 ; i < knownKeys.length ; i++ )
  {
    ret[knownKeys[i]] = [];
  }

  var thisGroup = groups[name];
  if ( !thisGroup )
    throw new Error('Unknown group: '+name);

  if ( thisGroup.group )
  {
    var subGroupName, subGroup;
    for ( i = 0 ; i < thisGroup.group.length ; i++ )
    {
      subGroupName = thisGroup.group[i];
      if ( alreadySeen.indexOf(subGroupName) >= 0 )
      {
        // Circular dependency and this group has already been included elsewhere
        continue;
      }
      else
      {
        alreadySeen.push(subGroupName);
      }

      subGroup = flatten(subGroupName,groups,alreadySeen);
      if ( !subGroup )
        throw new Error('Unknown subgroup:' +name);

      // Merge info from the subgroup
      for ( j = 0 ; j < knownKeys.length ; j++ )
      {
        mergeArrayInPlace(ret[ knownKeys[j] ], subGroup[ knownKeys[j] ] );
      }
    }
  }

  // Copy info from this group
  for ( j = 0 ; j < knownKeys.length ; j++ )
  {
    mergeArrayInPlace( ret[ knownKeys[j] ], thisGroup[ knownKeys[j] ] );
  }

  return ret;
}

 function mergeArrayInPlace(a,b)
 {
   if ( !b || b.length === 0 )
     return;
 
   var i, val;
   for ( i = 0 ; i < b.length ; i++ )
   {
     val = b[i];
     if ( a.indexOf(val) === -1 )
       a.push(val);
   }
 }

function resolveFile(groups, type, file, cb)
{
  var extensions = knownTypes[type];
  var baseDirs = groups._paths[type];
  var paths = [];

  for ( var i = 0, ilen = baseDirs.length; i < ilen ; i++ )
  {
    for ( var j = 0, jlen = extensions.length; j < jlen ; j++ )
    {
      paths.push( baseDirs[i] + '/' + file + (extensions[j] ? '.'+ extensions[j] : ''));
    }
  }

  var errStr = 'Unable to find source ' + type + ' file for ' + file + ' at ' + paths.toString();;

  if ( cb )
  {
    async.detectSeries(paths, _exists, function(result) {
      if ( result )
        return cb(undefined,result);
      else
        return cb(new Error(errStr));
    });
  }
  else
  {
    for ( i = 0, ilen = paths.length ; i < ilen ; i++ )
    {
      if ( fs.existsSync(paths[i]) )
      {
        return paths[i];
      }
    }

    throw new Error(errStr);
  }
}

function loadSource(groups, type, file, cb)
{
  resolveFile(groups, type, file, function(err, path) {
    if ( err )
      return cb(err);

    fs.readFile(path, 'utf8', cb);
  });
}

module.exports.load = load;
module.exports.resolveFile = resolveFile;
module.exports.loadSource = loadSource;
module.exports.types = _getSetTypes;
