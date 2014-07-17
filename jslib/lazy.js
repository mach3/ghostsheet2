/**
 * Lazy
 * ----
 * @class Deferred-like object for node.js
 * @author mach3<http://github.com/mach3>
 * @url https://gist.github.com/mach3/d12359a486525f7071fa
 */
var Lazy = function(){
    this.emitter = new (require("events").EventEmitter)();
    this.args = [];
};

(function(){
    var u, api = Lazy.prototype;

    api.EVENT_RESOLVED = "resolved";
    api.EVENT_REJECTED = "rejected";
    api.EVENT_ALL = ["resolved", "rejected"];

    api.state = null;
    api.args = null;
    api.emitter = null;

    /**
     * Trigger by state
     * @param {Boolean} state
     * @param {Array|Arguments} args
     * @returns Lazy
     */
    api._emit = function(state, args){
        state = !! state;
        args = Array.prototype.slice.call(args);
        this.args = args;
        this.state = state;
        this.emitter.emit.apply(
            this.emitter,
            [state ? this.EVENT_RESOLVED : this.EVENT_REJECTED].concat(args)
        );
        return this;
    };

    /**
     * Resolve the lazy object and call success-callback
     */
    api.resolve = function(){
        this._emit(true, arguments);
        return this;
    };

    /**
     * Reject the lazy object and call failure-callback
     */
    api.reject = function(){
        this._emit(false, arguments);
        return this;
    };

    /**
     * Add handler for resolved and rejected
     * @param {Function} done
     * @param {Function} fail
     */
    api.then = function(done, fail){
        if(u.isFunction(done)){
            this.done(done);
        }
        if(u.isFunction(fail)){
            this.fail(fail);
        }
        return this;
    };

    /**
     * Add handler for resolved
     * @param {Function} callback
     */
    api.done = function(callback){
        if(this.state === true){
            callback.apply(this, this.args);
        } else {
            this.emitter.once(this.EVENT_RESOLVED, callback);
        }
        return this;
    };

    /**
     * Add handler for rejected
     * @param {Function} callback
     */
    api.fail = function(callback){
        if(this.state === false){
            callback.apply(this, this.args);
        } else {
            this.emitter.once(this.EVENT_REJECTED, callback);
        }
        return this;
    };

    /**
     * Add handler for both of resolved and rejected
     * @param {Function} callback
     */
    api.always = function(callback){
        var args, my = this;
        if(this.state !== null){
            callback.apply(this, this.args);
        } else {
            this.EVENT_ALL.forEach(function(name){
                my.emitter.once(name, callback);
            });
        }
        return this;
    };

    /**
     * Utilities
     */
    u = {
        isFunction: function(obj){
            return typeof obj === "function";
        }
    };

}());

module.exports = function(){
    return new Lazy();
};