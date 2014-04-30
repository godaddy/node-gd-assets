var pathlib = require('path');
var util = require('util');
var fs = require('graceful-fs');
var async = require('async');

var SPECIAL_KEYS = ['baseDir','include','saveOutput'];
var HANDLER_KEYS = ['js','css','hbs','view'];
var VIEW_TYPES = ['hbs'];

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

    // Remember if we're supposed to save the output or not for compliling
    flattened.saveOutput = input.groups[groupName].saveOutput !== false;

    ret.groups[groupName] = flattened;
  });

  return ret;
}

// Flatten a single group into a list of files required for it
function _flatten(groups, groupName, alreadySeen)
{
  alreadySeen = alreadySeen || [];

  var ret = {};

  // Intialize each key to empty so we don't have to check if they exist later
  HANDLER_KEYS.forEach(function(key) {
    ret[key] = [];
  });

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
  // The label this file will have in the output
  // For hbs views, this is the name that it will be save as into the template array.
  var label = pathlib.basename(fileName);

  // Label can be overridden with entries of the form: "label:file-name-or-path"
  var idx = fileName.indexOf(':');
  if ( idx > 0 )
  {
    label = fileName.substr(0,idx);
    fileName = fileName.substr(idx+1);
  }

  // Construct a list of paths to check
  var paths = [];
  baseDirs.forEach(function(baseDir) {
    // Search for exact filename
    paths.push(pathlib.resolve(baseDir+'/'+type,fileName));

    // And with the type as an extension
    paths.push(pathlib.resolve(baseDir+'/'+type,fileName+'.'+type));

    // Special case 'view' because it used to mean hbs
    if ( type == 'view' )
    {
      VIEW_TYPES.forEach(function(altType) {
        paths.push(pathlib.resolve(baseDir+'/'+type,fileName+'.'+altType));
      });
    }
  });

  // Async
  if ( cb )
  {
    async.detectSeries(paths, fs.exists, function(result) {
      if ( result )
        return cb(undefined, label+':'+result);
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
        return label+':'+paths[i];
      }
    }

    throw new Error('Unable to find source ' + type + ' file for ' + fileName + ' in ' + paths.join(', '));
  }
}

function fileLabel(labelAndPath)
{
  var idx = labelAndPath.indexOf(':');
  return labelAndPath.substr(0,idx);
}

function filePath(labelAndPath)
{
  var idx = labelAndPath.indexOf(':');
  return labelAndPath.substr(idx+1);
}

module.exports.resolveFile = resolveFile;
module.exports.load = load;
module.exports.fileLabel = fileLabel;
module.exports.filePath = filePath;

