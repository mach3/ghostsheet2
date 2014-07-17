/**
 * Ghostsheet2
 * -----------
 * @class Fetch and cache Google Spreadsheet published data
 * @author mach3<http://github.com/mach3>
 * @url http://github.com/mach3/ghostsheet2
 */

var _ = require("underscore"),
    path = require("path"),
    util = require("util"),
    fs = require("fs"),
    scraper = require("scraper"),
    lazy = require("./lazy.js"),
    Ghostsheet;

Ghostsheet = function(options){
    this._construct.apply(this, arguments);
};

(function(){
    var api = Ghostsheet.prototype, u;

    api.defaults = {
        url: "https://docs.google.com/spreadsheets/d/%s/pubhtml",
        cache_dir: "./cache",
        cache_suffix: ".cache",
        cache_lifetime: 1000 * 60 * 60,
        timeout: 30
    };

    api.options = null;

    /**
     * Constructor
     * @constructor
     * @param {Object} options
     */
    api._construct = function(options){
        this.options = {};
        this.config(this.defaults).config(options);
    };

    /**
     * Configure options
     * @param {Object|String} options|key
     * @param {*} value
     */
    api.config = function(){
        var my, args;

        args = arguments;
        my = this;

        switch(u.type(args[0])){
            case "string":
                if(args.length > 1){
                    this.options[args[0]] = args[1];
                    return this;
                }
                return this.options[args[0]];
            case "object":
                _.each(args[0], function(value, key){
                    my.config(key, value);
                });
                return this;
            case "undefined":
                return this.options;
            default: break;
        }
        return this;
    };

    /**
     * Load:
     * - Check cache file's lifetime,
     * - If cache is alive, return cache data
     * - If not, fetch remote data and save it, return updated data
     * 
     * @param {String} key
     * @returns {Lazy}
     */
    api.load = function(key){
        var df, data, my;

        df = lazy();
        my = this;

        if(data = this._cache(key, null, false)){
            return df.resolve(data);
        }
        this.fetch(key)
        .done(function(data){
            my._cache(key, data);
            df.resolve(data);
        })
        .fail(function(e){
            df.reject(e);
        });
        return df;
    };

    /**
     * Fetch:
     * - Forcely fetch remote data
     * - Return the data without saving it as cache
     * 
     * @param {String} key
     * @returns {Lazy}
     */
    api.fetch = function(key){
        var df, url, my;

        df = lazy();
        my = this;
        url = util.format(this.config("url"), key);

        scraper(url, function(e, $){
            if(e){
                return df.reject("Failed to fetch resource");
            }
            df.resolve(my._parse(key, $));
        });
        return df;
    };

    /**
     * Cache:
     * - Forcely return cache data
     *
     * @param {String} key
     * @returns {Lazy}
     */
    api.cache = function(key){
        var data, df;

        df = lazy();

        if(data = this._cache(key, null, true)){
            df.resolve(data);
        } else {
            df.reject("Cache file not found");
        }
        return df;
    };

    /**
     * Update:
     * - Forcely fetch updated data and save it as cache
     * - Return the updated data
     * 
     * @param {String} key
     * @returns {Lazy}
     */
    api.update = function(key){
        var df, my;

        df = lazy();
        my = this;

        this.fetch(key)
        .done(function(data){
            if(my._cache(key, data)){
                return df.resolve(data);
            }
            df.reject("Failed to save cache");
        })
        .fail(function(e){
            df.reject(e);
        });

        return df;
    };

    /**
     * Save or get cache data
     * - Set `force` as `TRUE` to ignore lifetime when getting cache data
     * - Return object or null on getter
     * - Return boolean on setter
     *
     * @param {String} key
     * @param {Object} data
     * @param {Boolean} force
     * @returns {Object|Boolean}
     */
    api._cache = function(key, data, force){
        var file, modified, now;

        file = path.join(this.config("cache_dir"), key + this.config("cache_suffix"));

        // Try to fetch from cache, checking lifetime
        if(! data){
            if(! fs.existsSync(file)){
                return null;
            }
            modified = (new Date(fs.statSync(file).mtime)).getTime();
            now = (new Date()).getTime();
            if(! force && (now - modified) > this.config("cache_lifetime")){
                return null;
            }
            return JSON.parse(fs.readFileSync(file));
        }

        // Try to save cache
        try {
            fs.writeFileSync(file, JSON.stringify(data));
            return true;
        } catch(e){
            return false;
        }
    };

    /**
     * Parse the DOM to data
     * - Pass scraper function to second argument
     * 
     * @param {String} key
     * @param {Function} $
     * @returns {Object}
     */
    api._parse = function(key, $){
        var data = {
            title: $("title").text(),
            key: key,
            sheets: []
        };

        // Parse sheets
        $("#sheet-menu > li > a").each(function(){
            var menu, sheet;

            menu = $(this);
            sheet = {
                id: menu.attr("onclick").replace(/(^.+?'|'.+?$)/g, ""),
                name: menu.text(),
                fields: null,
                items: []
            };

            // Parse rows
            $(util.format("#%s tr", sheet.id)).each(function(){
                var row, item, cols;

                row = $(this);
                item = {};
                cols = [];

                // Parse columns
                row.find("td").each(function(){
                    cols.push($(this).text());
                });

                // No columns ? continue
                if(! cols.length){
                    return;
                }

                // Parse fields on first row
                if(! sheet.fields){
                    sheet.fields = cols.map(function(value){
                        return value.split(":");
                    });
                    return;
                }

                // Parse columns by fields
                sheet.fields.forEach(function(field, i){
                    item[field[0]] = u.juggle(cols[i], field[1]);
                });

                sheet.items.push(item);
            });

            data.sheets.push(sheet);
        });

        return data;
    };

    /**
     * Utilities
     */
    u = {

        /**
         * Get type of object
         * 
         * @param {*} obj
         * @returns {String}
         */
        type: function(obj){
            var m = Object.prototype.toString.call(obj).match(/\[object\s(\w+)\]/);
            return m ? m[1].toLowerCase() : null;
        },

        /**
         * Juggle value by type name
         * 
         * @param {String} value
         * @param {String} type
         * @returns {*}
         */
        juggle: function(value, type){
            type = type || "string";
            switch(type){
                case "int":
                case "integer":
                    return parseInt(value, 10);
                case "boolean":
                case "bool":
                    return (/^true$/i).test(value);
                case "float":
                case "double":
                    return new Number(value);
                default: break;
            }
            return value;
        }
    };

}());

module.exports = Ghostsheet;
