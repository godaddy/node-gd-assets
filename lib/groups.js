var pathlib = require('path');
var util = require('util');
var fs = require('graceful-fs');
var async = require('async');

var SPECIAL_KEYS = ['baseDir','include','save'];
var HANDLER_KEYS = ['js','css','hbs','view'];

// Read a group definition JSON file and massage each group into
// a flat list of absolute paths for each resource required
function load(inPath)
{
  var keys;

  // Group description file can be specified as relative to CWD
  var groupFilePath = pathlib.resolve(process.cwd(),inPath);

  // Paths are relative to the group description file (inPath) + /public by default
  var groupDir = pathlib.dirname(groupFilePath);
  var baseDir = pathlib.resolve(groupDir,'public');

  // Load the JSON description of the groups
  var input = require(groupFilePath);
  var ret = {};

  // 1. Resolve everything to absolute paths

  // 1a. Root file dirs
  ret.rootFileDirs = (input.rootFileDirs||[]).map(function(path) {
    return pathlib.resolve(baseDir, path);
  });

  // 1b. Static file dirs
  ret.staticFileDirs = {};
  keys = Object.keys(input.staticFileDirs||{});
  keys.forEach(function(key) {
    var paths = input.staticFileDirs[key];
    if ( !util.isArray(paths) )
      paths = [paths];

    ret.staticFileDirs[key] = paths.map(function(path) {
      return pathlib.resolve(baseDir, path);
    });
  });

  // 1c. Groups
  keys = Object.keys(input.groups||{});

  // Loop over each group definition
  ret.groups = {};
  keys.forEach(function(groupName) {
    var group = input.groups[groupName];
    var subKeys = Object.keys(group);

    var newGroup = {};

    // You can override the base directory per-group
console.log('Group basedir: ', group.baseDir);
console.log('Global basedir: ', baseDir);
    if ( group.baseDir )
    {
      var paths = group.baseDir;
      if ( !util.isArray(paths) )
        paths = [paths];

      newGroup.baseDir = paths.map(function(path) {
        // If baseDir is specified for the group, it's relative to the location of the asset file
        return pathlib.resolve(groupDir, path);
      });
    }
    else
    {
      newGroup.baseDir = [baseDir];
    }

    newGroup.include = group.include || [];
    newGroup.save = group.save !== false;

    // Loop over each key in the group definition
    subKeys.forEach(function(subKey) {
      if ( SPECIAL_KEYS.indexOf(subKey) >= 0 )
      {
        // We've already dealt with these
        return;
      }

      if ( HANDLER_KEYS.indexOf(subKey) === -1 )
      {
        throw new Error('Unknown group property: '+ subKey);
      }

      // Resolve file names into absolute paths
      newGroup[subKey] = (group[subKey]||[]).map(function(filename) {
        return resolveFile(newGroup.baseDir, filename, subKey);
      });
    });

    ret.groups[groupName] = newGroup;
  });

  // 2. Process each group into a flat list of the file names needed
  keys = Object.keys(ret.groups);
  keys.forEach(function(groupName) {
    var flattened = _flatten(ret.groups, groupName);
    ret.groups[groupName] = flattened;
  });

  return ret;
}

// Flatten a single group into a list of files required for it
function _flatten(groups, groupName, alreadySeen)
{
  alreadySeen = alreadySeen || [];

  var ret = {};

  var thisGroup = groups[groupName];
  if ( !thisGroup )
    throw new Error('Unknown group: ' + groupName);

  // If this group includes other groups, add them first
  if ( thisGroup.include )
  {
    thisGroup.include.forEach(function(subGroupName) {
      if ( alreadySeen.indexOf(subGroupName) >= 0 )
      {
        // Circular dependency and this group has already been included elsewhere
        return;
      }
      else
      {
        alreadySeen.push(subGroupName);
      }

      var subGroup = _flatten(groups, subGroupName, alreadySeen);
      if ( !subGroup )
        throw new Error('Unknown subgroup:' +subGroupName);

      HANDLER_KEYS.forEach(function(key) {
        if ( subGroup[key] )
        {
          _mergeArrayInPlace(ret[key], subGroup[key]);
        }
      });
    });
  }

  // Then add the individual files for this group at the end
  HANDLER_KEYS.forEach(function(key) {
    if ( thisGroup[key] )
    {
      _mergeArrayInPlace( ret[key], thisGroup[key] );
    }
  });

  return ret;
}

// Add the items in 'b' into 'a' (modifying the 'a' array passed in), ignoring duplicates
function _mergeArrayInPlace(a,b)
{
  if ( !b || b.length === 0 )
    return;

  b.forEach(function(val) {
    if ( a.indexOf(val) === -1 )
      a.push(val);
  });
}

// Resolve a file name into an absolute path
// Async if called with a cb, synchronous if not
function resolveFile(baseDirs, fileName, type, cb)
{
  console.log('resolveFile:', baseDirs, fileName, type);
  // Construct a list of paths to check
  var paths = [];
  baseDirs.forEach(function(baseDir) {
    // Search for exact filename
    paths.push(pathlib.resolve(baseDir+'/'+type,fileName));

    // And with the type as an extension
    paths.push(pathlib.resolve(baseDir+'/'+type,fileName+'.'+type));
  });

  // Async
  if ( cb )
  {
    async.detectSeries(paths, fs.exists, function(result) {
      if ( result )
        return cb(undefined,result);
      else
        return cb(new Error(errStr));
    });
  }
  else
  {
    // Sync
    for ( i=0 ; i < paths.length ; i++ )
    {
      if ( fs.existsSync(paths[i]) )
      {
        console.log('found:', paths[i]);
        return paths[i];
      }
    }

    throw new Error('Unable to find source ' + type + ' file for ' + fileName + ' in ' + paths.join(', '));
  }
}

function loadSource(groups, type, fileName, cb)
{
  resolveFile(groups, type, fileName, function(err, path) {
    if ( err )
      return cb(err);

    fs.readFile(path, 'utf8', cb);
  });
}

module.exports.resolveFile = resolveFile;
module.exports.loadSource = loadSource;
module.exports.load = load;
