!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.avs=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*!
Copyright (C) 2013 by WebReflection

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
var
  // should be a not so common char
  // possibly one JSON does not encode
  // possibly one encodeURIComponent does not encode
  // right now this char is '~' but this might change in the future
  specialChar = '~',
  safeSpecialChar = '\\x' + (
    '0' + specialChar.charCodeAt(0).toString(16)
  ).slice(-2),
  escapedSafeSpecialChar = '\\' + safeSpecialChar,
  specialCharRG = new RegExp(safeSpecialChar, 'g'),
  safeSpecialCharRG = new RegExp(escapedSafeSpecialChar, 'g'),

  safeStartWithSpecialCharRG = new RegExp('(?:^|[^\\\\])' + escapedSafeSpecialChar),

  indexOf = [].indexOf || function(v){
    for(var i=this.length;i--&&this[i]!==v;);
    return i;
  },
  $String = String  // there's no way to drop warnings in JSHint
                    // about new String ... well, I need that here!
                    // faked, and happy linter!
;

function generateReplacer(value, replacer, resolve) {
  var
    path = [],
    all  = [value],
    seen = [value],
    mapp = [resolve ? specialChar : '[Circular]'],
    last = value,
    lvl  = 1,
    i
  ;
  return function(key, value) {
    // the replacer has rights to decide
    // if a new object should be returned
    // or if there's some key to drop
    // let's call it here rather than "too late"
    if (replacer) value = replacer.call(this, key, value);

    // did you know ? Safari passes keys as integers for arrays
    // which means if (key) when key === 0 won't pass the check
    if (key !== '') {
      if (last !== this) {
        i = lvl - indexOf.call(all, this) - 1;
        lvl -= i;
        all.splice(lvl, all.length);
        path.splice(lvl - 1, path.length);
        last = this;
      }
      // console.log(lvl, key, path);
      if (typeof value === 'object' && value) {
        lvl = all.push(last = value);
        i = indexOf.call(seen, value);
        if (i < 0) {
          i = seen.push(value) - 1;
          if (resolve) {
            // key cannot contain specialChar but could be not a string
            path.push(('' + key).replace(specialCharRG, safeSpecialChar));
            mapp[i] = specialChar + path.join(specialChar);
          } else {
            mapp[i] = mapp[0];
          }
        } else {
          value = mapp[i];
        }
      } else {
        if (typeof value === 'string' && resolve) {
          // ensure no special char involved on deserialization
          // in this case only first char is important
          // no need to replace all value (better performance)
          value = value .replace(safeSpecialChar, escapedSafeSpecialChar)
                        .replace(specialChar, safeSpecialChar);
        }
      }
    }
    return value;
  };
}

function retrieveFromPath(current, keys) {
  for(var i = 0, length = keys.length; i < length; current = current[
    // keys should be normalized back here
    keys[i++].replace(safeSpecialCharRG, specialChar)
  ]);
  return current;
}

function generateReviver(reviver) {
  return function(key, value) {
    var isString = typeof value === 'string';
    if (isString && value.charAt(0) === specialChar) {
      return new $String(value.slice(1));
    }
    if (key === '') value = regenerate(value, value, {});
    // again, only one needed, do not use the RegExp for this replacement
    // only keys need the RegExp
    if (isString) value = value .replace(safeStartWithSpecialCharRG, specialChar)
                                .replace(escapedSafeSpecialChar, safeSpecialChar);
    return reviver ? reviver.call(this, key, value) : value;
  };
}

function regenerateArray(root, current, retrieve) {
  for (var i = 0, length = current.length; i < length; i++) {
    current[i] = regenerate(root, current[i], retrieve);
  }
  return current;
}

function regenerateObject(root, current, retrieve) {
  for (var key in current) {
    if (current.hasOwnProperty(key)) {
      current[key] = regenerate(root, current[key], retrieve);
    }
  }
  return current;
}

function regenerate(root, current, retrieve) {
  return current instanceof Array ?
    // fast Array reconstruction
    regenerateArray(root, current, retrieve) :
    (
      current instanceof $String ?
        (
          // root is an empty string
          current.length ?
            (
              retrieve.hasOwnProperty(current) ?
                retrieve[current] :
                retrieve[current] = retrieveFromPath(
                  root, current.split(specialChar)
                )
            ) :
            root
        ) :
        (
          current instanceof Object ?
            // dedicated Object parser
            regenerateObject(root, current, retrieve) :
            // value as it is
            current
        )
    )
  ;
}

function stringifyRecursion(value, replacer, space, doNotResolve) {
  return JSON.stringify(value, generateReplacer(value, replacer, !doNotResolve), space);
}

function parseRecursion(text, reviver) {
  return JSON.parse(text, generateReviver(reviver));
}
this.stringify = stringifyRecursion;
this.parse = parseRecursion;
},{}],2:[function(require,module,exports){
// Generated by CoffeeScript 1.8.0

/*
  @author Gilles Gerlinger
  Copyright 2014. All rights reserved.
 */

(function() {
  var Local, Remote, Rpc, angularRpc, ioRpc, json, wsRpc, xmlHttpRpc,
    __slice = [].slice,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  json = require('circular-json');

  Local = (function() {
    function Local(local, method, asynchronous) {
      this.local = local;
      this.asynchronous = asynchronous;
      this[method] = (function(_this) {
        return function(id, args, cb) {
          var _ref;
          console.log("rpc " + id + ": local " + method + " - asynchronous: " + _this.asynchronous);
          return (_ref = _this.local)[method].apply(_ref, __slice.call(args).concat([cb]));
        };
      })(this);
    }

    return Local;

  })();

  Remote = (function() {
    Remote.prototype.count = 0;

    function Remote() {
      var method, methods, rpc, _i, _len;
      rpc = arguments[0], methods = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      this.rpc = rpc;
      this.uid = (Math.random() + '').substring(2, 8);
      for (_i = 0, _len = methods.length; _i < _len; _i++) {
        method = methods[_i];
        this[method] = new Function("", "var arg, args, cb, last, _i, _len; args = []; for (_i = 0, _len = arguments.length; _i < _len; _i++) { args.push(arguments[_i]); } last = arguments[arguments.length - 1]; if (typeof last === 'function') { cb = last; args.pop()} return this.rpc._request({method:'" + method + "', args:args, cb:cb, id:'" + this.uid + "-'+(++this.count)});");
      }
    }

    return Remote;

  })();

  exports.Rpc = Rpc = (function() {
    Rpc.prototype.cbID = 0;

    function Rpc() {
      this.locals = [];
      this.callbacks = [];
      this._out = (function(_this) {
        return function(msg, message) {
          return _this.log("rpc " + msg.id + " error: no rpc out route defined");
        };
      })(this);
    }

    Rpc.prototype.out = function(send) {
      return this._out = send;
    };

    Rpc.prototype._request = function(msg) {
      var cbname, message;
      if (msg.cb && typeof msg.cb === 'function') {
        this.callbacks[cbname = msg.method + (" cb" + (this.cbID++))] = msg.cb;
        msg.cb = cbname;
      }
      message = json.stringify(msg);
      this.log("rpc " + msg.id + ": out " + message);
      this._out(msg, message);
      return message;
    };

    Rpc.prototype._reply = function(msg, args) {
      if (msg.cb) {
        return this._request({
          method: msg.cb,
          args: args,
          id: msg.id
        });
      }
    };

    Rpc.prototype._error = function(msg, args) {
      if (msg.cb) {
        return this._request({
          method: msg.cb,
          args: args,
          err: true,
          id: msg.id
        });
      }
    };

    Rpc.prototype.process = function(message) {
      var args, e, err, local, msg, rst;
      try {
        if (typeof message === 'string') {
          msg = json.parse(message);
        } else {
          message = json.stringify(msg = message);
        }
        if (!(msg && msg.method)) {
          this.log(args = "rpc error: message is null");
          this._error({
            method: 'missing'
          }, args);
          return;
        }
        local = this.locals[msg.method];
        this.log("rpc " + msg.id + ": in  " + message);
        if (local) {
          if (local.asynchronous) {
            return local[msg.method](msg.id, msg.args, (function(_this) {
              return function(rst, err) {
                if (err) {
                  return _this._error(msg, err);
                } else {
                  return _this._reply(msg, rst);
                }
              };
            })(this));
          } else {
            return this._reply(msg, local[msg.method](msg.id, msg.args));
          }
        } else if (this.callbacks[msg.method]) {
          if (msg.err) {
            err = msg.args;
          } else {
            rst = msg.args;
          }
          this.callbacks[msg.method](rst, err);
          return delete this.callbacks[msg.method];
        } else {
          this.log(args = "error: method " + msg.method + " is unknown");
          return this._error(msg, args);
        }
      } catch (_error) {
        e = _error;
        this.log(args = "error in " + msg.method + ": " + e);
        return this._error(msg, args);
      }
    };

    Rpc.prototype._splat = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      if (arguments.length === 1 && typeof arguments[0] !== 'string') {
        return arguments[0];
      } else {
        return args;
      }
    };

    Rpc.prototype.remote = function() {
      var methods;
      methods = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return (function(func, args, ctor) {
        ctor.prototype = func.prototype;
        var child = new ctor, result = func.apply(child, args);
        return Object(result) === result ? result : child;
      })(Remote, [this].concat(__slice.call(this._splat.apply(this, methods))), function(){});
    };

    Rpc.prototype.implement = function() {
      var local, methods;
      local = arguments[0], methods = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      return this._expose.apply(this, [local, false].concat(__slice.call(this._splat.apply(this, methods))));
    };

    Rpc.prototype.implementAsync = function() {
      var local, methods;
      local = arguments[0], methods = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      return this._expose.apply(this, [local, true].concat(__slice.call(this._splat.apply(this, methods))));
    };

    Rpc.prototype._expose = function() {
      var asynchronous, local, method, methods, _i, _len, _results;
      local = arguments[0], asynchronous = arguments[1], methods = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
      if (!methods.length) {
        for (method in local) {
          if (typeof local[method] === 'function' && method.charAt(0) !== '_') {
            methods.push(method);
          }
        }
        this.log("rpc methods found: " + methods);
      }
      _results = [];
      for (_i = 0, _len = methods.length; _i < _len; _i++) {
        method = methods[_i];
        if (!local[method]) {
          _results.push(this.log("rpc warning: local object has no method " + method));
        } else {
          if (this.locals[method]) {
            this.log("rpc warning: duplicate method " + method + ", now asynchronous: " + asynchronous);
          }
          _results.push(this.locals[method] = new Local(local, method, asynchronous));
        }
      }
      return _results;
    };

    Rpc.prototype.log = function(text) {
      return console.log(text.length < 128 ? text : text.substring(0, 127) + ' ...');
    };

    return Rpc;

  })();

  exports.wsRpc = wsRpc = (function(_super) {
    __extends(wsRpc, _super);

    function wsRpc(ws) {
      wsRpc.__super__.constructor.call(this);
      if (ws && ws.send) {
        this.out(function(msg, message) {
          return ws.send(message, (function(_this) {
            return function(err) {
              if (err) {
                return _this.log(err.toString());
              }
            };
          })(this));
        });
      }
      this["in"](ws);
    }

    wsRpc.prototype["in"] = function(ws) {
      if (ws) {
        if (ws.on) {
          return ws.on('message', (function(_this) {
            return function(message, flags) {
              if (!flags.binary) {
                return _this.process(message);
              }
            };
          })(this));
        } else {
          return ws.onmessage = (function(_this) {
            return function(e) {
              if (e.data.length) {
                return _this.process(e.data);
              }
            };
          })(this);
        }
      }
    };

    return wsRpc;

  })(Rpc);

  exports.angularRpc = angularRpc = (function(_super) {
    __extends(angularRpc, _super);

    function angularRpc(http) {
      angularRpc.__super__.constructor.call(this);
      this.out(function(msg, message) {
        return http.post('/rpc', msg).success((function(_this) {
          return function(message) {
            if (message) {
              return _this.process(message);
            }
          };
        })(this));
      });
    }

    return angularRpc;

  })(Rpc);

  exports.xmlHttpRpc = xmlHttpRpc = (function(_super) {
    __extends(xmlHttpRpc, _super);

    function xmlHttpRpc(xhr) {
      xmlHttpRpc.__super__.constructor.call(this);
      this.out(function(msg, message) {
        xhr.open('POST', '/rpc', true);
        xhr.setRequestHeader('Content-type', 'application/json');
        xhr.onload((function(_this) {
          return function() {
            return _this.process(xhr.response);
          };
        })(this));
        return xhr.send(message);
      });
    }

    return xmlHttpRpc;

  })(Rpc);

  exports.ioRpc = ioRpc = (function(_super) {
    __extends(ioRpc, _super);

    function ioRpc(socket) {
      ioRpc.__super__.constructor.call(this);
      if (socket) {
        this.out(function(msg, message) {
          return socket.emit('rpc', msg);
        });
        socket.on('rpc', (function(_this) {
          return function(msg) {
            return _this.process(msg);
          };
        })(this));
      }
    }

    return ioRpc;

  })(Rpc);

}).call(this);

},{"circular-json":1}]},{},[2])(2)
});