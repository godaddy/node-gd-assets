gd-assets
========
JS/CSS combining, compression, and serving.

[![Dependency Status](https://gemnasium.com/godaddy/node-gd-assets.svg)](https://gemnasium.com/godaddy/node-gd-assets)

# Usage

## Compiling to files
```javascript
var Assets    = require('gd-assets');
var config    = Assets.config.load('/path/to/your/assets.json');
var pkg       = require(/path/to/your/package.json');
var outputDir = '/path/to/compiled'

var opt = {
  // See options
};

Assets.compile(config, pkg, outputDir, opt);
```

## As a middleware
```javascript
var app = express(); // Or connect

var Assets = require('gd-assets');
var config = Assets.config.load(/path/to/your/assets.json');
var opt = {
  // See options
};

Assets.middleware(app, config, opt);
```

## As a standalone server
```javascript
var Assets = require('gd-assets');
var config = Assets.config.load('/path/to/assets.json');
var pkg    = require('/path/to/package.json');
var port   = 3000;

assets.server(config, pkg, port);
```

# Options

Name | Applies To | Default | Description
-----|------------|---------|-------------
<code>prefix:</code> | Middleware | / | Base path to listen for requests on.  e.g. '/assets' will make things available at http://host:port/assets/something.js
<code>rootPrefix:</code> | Middleware | / | If [root files](#root-files) are specified, the base path to listen for root requests on.  Since the point of root files is to be at the root, you probably don't want to change this.
<code>tplPrefix:</code>  | All | *none* | If set, this prefix will prepended to template names in the compiled output, so you will ask handlebars to render <code>{tplPrefix}{templateName}</code>
<code>handlebarVar:</code> | All | Handlebars | Client-side variable name where Handlebars can be found.  Will be included in the compiled output.
<code>templateVar:</code> | All | Handlebars.templates | Client-side variable name where compiled templates will be put.
<code>emberViews:</code> | All | false | If true, use Ember's Handlebars to produce compiled views that will work in Ember instead of the standard Handlebars.
<code>emberPath: | All | *none* | If <code>emberViews:</code> is <code>true</code>, the path to ember.js to use when compiling
<code>handlebarsPath:</code> | All | *none* | If <code>emberViews:</code> is <code>true</code>, the path to handlebars.js to use when compiling
<code>jsmin:</code> | All | {warnings: false, hoist_funs: false} | Options to pass to UglifyJS (see [documentation](https://github.com/mishoo/UglifyJS2)) 

# Assets.json file
--------

## CSS and JavaScript files
The assets.json file describes which files should be processed, and how they should be grouped together.  The file can be called whatever you like, but it must contain a JSON dictionary.  It is easiest to describe with an example:
```javascript
{
  "groups": {
    "main": {
      "js":   ["init","util","main"],
      "view": ["layout","index","login"],
      "css":  ["bootstrap","app"]
    }
  }
}
```

This will combine:
```
  js/init.js
  js/util.js
  js/main.js
  The pre-compiled representation of view/layout.hbs
  The pre-compiled representation of view/index.hbs
  The pre-compiled representation of view/login.hbs
```
into one file and make it available as <code>main.js</code> (in compiling files mode), <code>{prefix}/main.js</code> (in middleware mode), or <code>http://localhost/main.js</code> (in standalone server mode).  

It will also combine
```
  css/bootstrap.css
  css/app.js
```
into one <code>main.css</code> in the same places.

A minified version of each is also produced, <code>main.min.js</code> and <code>main.min.css</code>.

## Groups
All files are included in the output in the order they appear in the input arrays.  Groups can include other groups (and so on). Includes will be included before the other files of that group.
```javascript
{
  "groups": {
    "framework": {
      "saveOutput": false,
      "view": ["layout","index"],
      "css":  ["bootstrap"],
      "js": ["init","util"]
    },

    "main": {
      "include": ["framework"],
      "view": ["login"],
      "css":  ["app"],
      "js": ["main"]
    }
  }
}
```
Groups that contain <code>"saveOutput": false</code> can be used as includes in other groups for logical organization, but will not produce any output file/URL themselves.  In the example above, only <code>main[.min].[js|css]</code> would be produced, not <code>framework[.min].[js|css]</code>

## Images and other static files
Directories of additional 'static' assets that do not need to be compiled may also be included using the <code>"staticFileDirs":</code> property.
```javascript
{
  "staticFileDirs": {
    "image": "public/my-images",
    "font":  "/path/to/some/fonts"
  }
}
```
The above example will make the contents of <code>public/my-images</code> available at <code>{prefix}/image/</code> and <code>/path/to/some/fonts</code> at <code>{prefix}/font</code>.

## Root files
Root files are similar to staticFileDirs, but are intended to be served from the absolute root of your URL (http://app.com/).  This is useful for things like favicon.ico and robots.txt that are expected to be at the root of the site even if the rest of the assets aren't.
```javascript
{
  "rootFileDirs": [
    "root",
    "/path/to/more/root/stuff"
  ]
}
```

## Path resolution
All paths are relative to <code>{the location of the assets.json file}/public</code> by default.  Relative paths may include <code>../</code>:
```javascript
{
  "staticFileDirs": {
    "image": "../vendor/blah/images"
  }
}
```

You may also specify absolute paths:
```javascript
{
  "staticFileDirs": {
    "image": "/path/to/some/images"
  }
}
```

Individual groups may specify an alternate base directory for the paths to be relative to:
```javascript
{
  "groups": {
    "main": {
      "baseDir": "vendor", // <-- Relative to the directory the assets.json file is in, or absolute
      "js": [
        "jquery" // <-- Will look for {directory assets.json file is in}/vendor/jquery.js
      ]
    }
  }
}
```
