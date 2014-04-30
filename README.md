gd-assets
========
JS/CSS combining, compression, and serving.

[![Dependency Status](https://gemnasium.com/godaddy/node-gd-assets.svg)](https://gemnasium.com/godaddy/node-gd-assets)
[![NPM](http://img.shields.io/npm/godaddy/node-gd-assets.svg)](https://www.npmjs.org/package/gd-assets)

# Usage

## Compiling to files
```javascript
var assets    = require('gd-assets');
var groups    = assets.groups.load('/path/to/assets.json');
var pkg       = require(/path/to/package.json');
var outputDir = '/path/to/compiled'

var opt = {
  // See options
};

assets.compile(groups, pkg, outputDir, opt);
```

## As a middleware
```javascript
var app = express(); // Or connect

var assets = require('gd-assets');
var groups = assets.groups.load(/path/to/assets.json');
var opt = {
  // See options
};

assets.middleware(app, groups, opt);
```

## As a standalone server
```javascript
var assets = require('gd-assets');
var groups = assets.groups.load('/path/to/assets.json');
var pkg    = require('/path/to/package.json');
var port   = 3000;

assets.server(groups, pkg, port);
```

# Options

Name | Applies To | Default | Description
-----|------------|---------|-------------
<code>prefix:</code> | Middleware | / | Base path to listen for requests on.  e.g. '/assets' will make things available at http://host:port/assets/something.js
<code>rootPrefix:</code> | Middleware | / | If a [root](#root-files) path is present, the base path to listen for root requests on.
<code>tplPrefix:</code>  | All | *none* | If set, this prefix will prepended to template names in the compiled output, so you will ask handlebars to render <code>{tplPrefix}{templateName}</code>
<code>handlebarVar:</code> | All | Handlebars | Client-side variable name where Handlebars can be found.  Will be included in the compiled output.
<code>templateVar:</code> | All | Handlebars.templates | Client-side variable name where compiled templates will be put.
<code>emberViews:</code> | All | false | If true, use Ember's handlebars to produce compiled views that will work in Ember
<code>emberPath: | All | *none* | If <code>emberViews:</code> is <code>true</code>, the path to ember.js to use when compiling
<code>handlebarsPath:</code> | All | *none* | If <code>emberViews:</code> is <code>true</code>, the path to handlebars.js to use when compiling
<code>jsmin:</code> | All | {warnings: false} | Options to pass to UglifyJS (see [documentation](https://github.com/mishoo/UglifyJS2)) 

# Assets.json file
--------
The assets.json file describes which files should be processed, and how they should be grouped together.  It must be a JSON dictionary with group names as the keys, and is easier described in example:
```javascript
{
  "main": {
    "view": ["layout","index","login"],
    "css":  ["bootstrap","app"],
    "js": ["init","util","main"]
  }
}
```

This will combine:
```
  view/layout.hbs
  view/index.hbs
  view/login.hbs
  js/init.js
  js/util.js
  js/main.js
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
All files are included in the output in the order they appear in the input arrays.  Groups can include other groups (and so on). These will be included before the other files of that group.
```javascript
{
  "_framework": {
    "view": ["layout","index"],
    "css":  ["bootstrap"],
    "js": ["init","util"]
  },

  "main": {
    "group": ["_framework"],
    "view": ["login"],
    "css":  ["app"],
    "js": ["main"]
  }

```
Group names that start with an underscore will not produce any output files, so you can use them just as logical organization.  In the example above, only <code>main[.min].[js|css]</code> would be produced.

## Static files
A special key <code>"_paths"</code> can be used to include static files like images and fonts:
```javascript
{
  "_paths": {
    "root": "public/root",
    "image": "public/my-images"
  }
}
```
The above example will make the contents of <code>public/my-images</code> available at <code>{prefix}/image/</code>.

## Root files
<code>"root"</code> is a special key for static that makes things availble at <code>{rootPrefix}/</code>.  This is useful for things like favicon.ico and robots.txt that must be at the root of the server even if the rest of the assets aren't.
