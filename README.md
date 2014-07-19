
# Ghostsheet2

Fetch new google spreadsheet published page as parsed data  
(For older spreadsheet, see [Ghostsheet](http://github.com/mach3/ghostsheet))

## Usage (PHP)

### Create Spreadsheet

Example:

<table>
    <tr>
        <th>name</th>
        <th>age:integer</th>
        <th>email</th>
        <th>active:bool</th>
    </tr>
    <tr>
        <td>John</td>
        <td>23</td>
        <td>john@example.com</td>
        <td>true</td>
    </tr>
    <tr>
        <td>Tom</td>
        <td>18</td>
        <td>tom@example.com</td>
        <td>false</td>
    </tr>
</table>

Then publish the spreadhseet as web page.  
Note your spreadsheet's key (like: 00X_xxxXX_0xXxxXx00XXXxx-xxXXxX0-XxXxXx0XxxX)

### Get Data

    require "the/path/to/ghostsheet/phplib/Ghostsheet.php";

    $gs = new Ghostsheet();
    $data = $gs->load("00X_xxxXX_0xXxxXx00XXXxx-xxXXxX0-XxXxXx0XxxX");

    if(! $data){
        die("Failed");
    }

    var_dump($data);

## API (PHP)

### Methods

#### **config([$key:String|$options:Array, [$value:\*]]) :\***  

Configure options

#### get($key:String, $mode:String = "load") :Array

Get data by specified mode (load|fetch|cache|update)

#### load($key:String) :Array

- If cache file is alive, get the content of cache file.
- If cache file doesn't exist or lifetime expires, fetch new data from remote, save it as cache file.

#### fetch($key:String) :Array

- Forcely fetch data from remote.
- This doesn't save it as cache.
- This ignores cache lifetime

#### cache($key:String) :Array

- Forcely get data from cache.
- If cache file doesn't exists, returns null.  
- This ignores cache lifetime

#### update($key:String) :Array

- Forcely fetch data from remote and save it as cache
- This ignores cache lifetime

### Options

- **cache_suffix** :String ... Extention of cache file
- **cache_dir** :String ... Directory to save cache file
- **cache_lifetime** :Integer ... Cache file lifetime
- **url** :String ... Spreadsheet publish URL
- **timeout** :Integer ... Timeout setting for CURL


## Other Languages

### Node.js

Though interfaces of the class are almost the same as PHP's one,
methods return not object, but deferred-like object.
Returned object has methods like `done()`, `fail()` and `then()`.

    var gs = new (require("ghostsheet"));

    gs.load("00X_xxxXX_0xXxxXx00XXXxx-xxXXxX0-XxXxXx0XxxX")
    .then(function(data){
        console.log(data);
    }, function(){
        console.error("Failed");
    });

### Grunt Task

This just fetch file and save data as JSON file.

    grunt.initConfig({
        ghostsheet: {
            dev: {
                files: {
                    "./data/mydata.json": "00X_xxxXX_0xXxxXx00XXXxx-xxXXxX0-XxXxXx0XxxX"
                }
            }
        }
    });

    grunt.loadNpmTasks("ghostsheet");
