var util = require('util');
var fs  = require('graceful-fs');
var ncp = require('ncp').ncp;

var handlers = require('./handlers');

function _copy(src,dest)
{
  ncp(src, dest, function(err) {
    if ( err )
    {
      console.log('Error copying:' + src,"to",dest,":",err.toString());
      process.exit(1);
    }
  });
}

function compile(groupDef, pkg, outputDir, opt)
{
  var keys, key, paths, path, vals;
  opt = opt || {};

  console.log('Output Dir:',outputDir)
  if ( !fs.existsSync(outputDir) )
    fs.mkdirSync(outputDir);

  // Root files
  if ( groupDef.rootFileDirs )
  {
    paths = groupDef.rootFileDirs;
    if ( !util.isArray(paths) )
      paths = [paths];

    paths.forEach(function(path) {
      console.log('Copying files in ', path,'to',outputDir+'/');
      var files = fs.readdirSync(path).forEach(function(file) {
        _copy(path+'/'+file, outputDir+'/'+file);
      });
    });
  }

  // Static files
  keys = Object.keys(groupDef.staticFileDirs);
  keys.forEach(function(key) {
    paths = groupDef.staticFileDirs[key];
    if ( !util.isArray(paths) )
      paths = [paths];

    paths.forEach(function(path) {
      if ( !path )
        return;

      console.log('Copying',key,path,'to',outputDir+'/'+key+'/');
      _copy(path, outputDir+'/'+key);
    });
  });

  keys = Object.keys(groupDef.groups);
  keys.forEach(function(key) {
    var group = groupDef.groups[key];
    
    // Skip groups that don't need to be written to disk
    if ( group.saveOutput === false )
      return;

    console.log('Compiling',key+'...');
    handlers.css.fetch(   group, key, opt, write.bind(null, outputDir+'/'+key+'.css'));
    handlers.css.fetchMin(group, key, opt, write.bind(null, outputDir+'/'+key+'.min.css'));
    handlers.js.fetch(    group, key, opt, write.bind(null, outputDir+'/'+key+'.js'));
    handlers.js.fetchMin( group, key, opt, write.bind(null, outputDir+'/'+key+'.min.js'));
  });
}

function write(path,err,src)
{
  if ( err )
  {
    console.log('Error compiling:', err);
    process.exit(1);
    return;
  }

  fs.writeFileSync(path, src);
  console.log('Wrote',path,'('+src.length+' bytes)');
}

module.exports = compile;
