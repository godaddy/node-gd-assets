var util = require('util');
var fs  = require('fs');
var ncp = require('ncp').ncp;
var css = require('./routes/css');
var js = require('./routes/js');

function compile(groups, pkg, outputDir)
{
  var keys, key, path, vals, i, j, ilen, jlen;

  if ( !fs.existsSync(outputDir) )
    fs.mkdirSync(outputDir);

  outputDir += '/' + pkg.version;
  console.log('Output Dir:',outputDir)
  if ( !fs.existsSync(outputDir) )
    fs.mkdirSync(outputDir);

  if ( groups._paths['root'] )
  {
    path = groups._paths['root'];
    console.log('Copying files in ', path,'to',outputDir+'/');
    var files = fs.readdirSync(path);
    for ( i = 0, ilen = files.length ; i < ilen; i++ )
    {
      ncp(path+'/'+files[i], outputDir+'/', function(err) {
        if ( err )
        {
          console.log('Error copying ' + path+'/'+files[i], err.toString());
          process.exit(1);
        }
      });
    }
  }

  keys = Object.keys(groups._paths);
  for ( i = 0, ilen = keys.length ; i < ilen; i++ )
  {
    key = keys[i];

    if ( ['js','css','view','root'].indexOf(key) >= 0 )
      continue;

    vals = groups._paths[key];
    if ( !util.isArray(vals) )
      vals = [vals];

    for ( j = 0, jlen = vals.length ; j < jlen ; j++ )
    {
      path = vals[j];

      if ( !path )
        continue;

      console.log('Copying',key,path,'to',outputDir+'/'+key);
      ncp(path, outputDir+'/'+key, function(err) {
        if ( err )
        {
          console.log('Error copying ' + path, err.toString());
          process.exit(1);
        }
      });
    }
  }

  keys = Object.keys(groups);
  key;
  for ( i = 0, ilen = keys.length ; i < ilen ; i++ )
  {
    key = keys[i];
    if ( key.substr(0,1) == '_' )
    {
      // Skip '_paths' and other special fields
      continue;
    }

    console.log('Compiling',key+'...');
    css.fetch(   groups, key, {}, write.bind(null, outputDir+'/'+key+'.css'));
    css.fetchMin(groups, key, {}, write.bind(null, outputDir+'/'+key+'.min.css'));
    js.fetch(    groups, key, {}, write.bind(null, outputDir+'/'+key+'.js'));
    js.fetchMin( groups, key, {}, write.bind(null, outputDir+'/'+key+'.min.js'));
  }
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
