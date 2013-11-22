var util = require('util');
var fs  = require('graceful-fs');
var ncp = require('ncp').ncp;
var css = require('./routes/css');
var js = require('./routes/js');

var specialKeys = ['js','css','view','root'];
var rootKey = 'root';

function copy(src,dest)
{
  ncp(src, dest, function(err) {
    if ( err )
    {
      console.log('Error copying:' + src,"to",dest,":",err.toString());
      process.exit(1);
    }
  });
}

function compile(groups, pkg, outputDir, opt)
{
  var keys, key, paths, path, vals;
  opt = opt || {};

  if ( !fs.existsSync(outputDir) )
    fs.mkdirSync(outputDir);

  console.log('Output Dir:',outputDir)
  if ( !fs.existsSync(outputDir) )
    fs.mkdirSync(outputDir);

  if ( groups._paths['root'] )
  {
    paths = groups._paths['root'];
    if ( !util.isArray(paths) )
      paths = [paths];

    paths.forEach(function(path) {
      console.log('Copying files in ', path,'to',outputDir+'/');
      var files = fs.readdirSync(path).forEach(function(file) {
        copy(path+'/'+file,outputDir+'/'+file);
      });
    });
  }

  keys = Object.keys(groups._paths);
  keys.forEach(function(key) {
    if ( specialKeys.indexOf(key) >= 0 )
      return;;

    paths = groups._paths[key];
    if ( !util.isArray(paths) )
      paths = [paths];

    paths.forEach(function(path) {
      if ( !path )
        return;

      console.log('Copying',key,path,'to',outputDir+'/'+key);
      copy(path, outputDir+'/'+key);
    });
  });

  keys = Object.keys(groups);
  keys.forEach(function(key) {
    if ( key.substr(0,1) == '_' )
    {
      // Skip '_paths' and other special fields
      return;
    }

    console.log('Compiling',key+'...');
    css.fetch(   groups, key, opt, write.bind(null, outputDir+'/'+key+'.css'));
    css.fetchMin(groups, key, opt, write.bind(null, outputDir+'/'+key+'.min.css'));
    js.fetch(    groups, key, opt, write.bind(null, outputDir+'/'+key+'.js'));
    js.fetchMin( groups, key, opt, write.bind(null, outputDir+'/'+key+'.min.js'));
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
