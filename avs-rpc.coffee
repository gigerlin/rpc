###
  @author Gilles Gerlinger
  Copyright 2014. All rights reserved.
###
json = require 'circular-json'

class Local
  constructor: (@local, method, @asynchronous) ->
    @[method] = (args, cb) => 
      console.log "rpc local: #{method}"
      @local[method] args..., cb

class Remote
  count:0
  constructor: (@rpc, methods) ->
    @uid = (Math.random() + '').substring 2, 8
    for method in methods
      @[method] = new Function "", "var arg, args, cb, last, _i, _len; args = [];
        for (_i = 0, _len = arguments.length; _i < _len; _i++) { args.push(arguments[_i]); }
        last = arguments[arguments.length - 1];
        if (typeof last === 'function') { cb = last; args.pop()}
        return this.rpc._request({method:'#{method}', args:args, cb:cb, id:'#{this.uid}-'+(++this.count)});"

#
# calls any number of arguments (string, number or object), plus a callback (callback is the last arg)
#
exports.Rpc = class Rpc 
  cbID:0
  constructor: -> 
    @locals = [] 
    @callbacks = []
    @_out = (msg, message) => @log "rpc #{msg.id} error: no rpc out route defined"

  out: (send) -> @_out = send
  
  _request: (msg) -> # call remote proc
    if msg.cb and typeof msg.cb is 'function'
      @callbacks[cbname = msg.method + " cb#{@cbID++}"] = msg.cb
      msg.cb = cbname

    message = json.stringify msg
    @log "rpc #{msg.id}: out #{message}" 
    @_out msg, message # provide both formats: object and stringified
    return message

  _reply: (msg, args) -> @_request method:msg.cb, args:args, id:msg.id if msg.cb # simple alias
  _error: (msg, args) -> @_request method:msg.cb, args:args, err:true, id:msg.id if msg.cb

  process: (message) -> # execute local method upon remote request
    try
      if typeof message is 'string'
        msg = json.parse message
      else
        message = json.stringify msg = message

      unless msg and msg.method
        @log args = "rpc error: message is null"
        @_error method:'missing', args
        return

      local = @locals[msg.method]
      @log "rpc #{msg.id}: in  #{message}"  
      if local
        unless local.asynchronous
          @_reply msg, local[msg.method] msg.args
        else 
          if msg.cb
            #@log "rpc #{msg.id}: creating callback #{msg.cb}"
            cb = (rst, err) => 
              #@log "rpc #{msg.id}: executing callback #{msg.cb}, error: #{err}"
              if err then @_error msg, err else @_reply msg, rst
          if msg.args then local[msg.method] msg.args, cb else local[msg.method] cb

      else if @callbacks[msg.method]
        if msg.err
          @callbacks[msg.method] undefined, msg.args # callback accepts an error (rst, err)
        else
          @callbacks[msg.method] msg.args
        delete @callbacks[msg.method]
      else 
        @log args = "error: method #{msg.method} is unknown"
        @_error msg, args
    catch e
      @log args = "error in #{msg.method}: #{e}"
      @_error msg, args

  remote: (methods) -> new Remote @, @_format methods
  _expose: (local, methods, asynchronous) -> # locally checkings can be performed
    unless methods
      methods = []
      for method in Object.keys local
        methods.push method if typeof local[method] is 'function'
    for method in @_format methods
      unless local[method]
        @log "rpc warning: local object has no method #{method}"
      else if @locals[method]
        @log "rpc warning: duplicate method #{method}"       
      else 
        @locals[method] = new Local local, method, asynchronous

  implement: (local, methods) -> @_expose local, methods, false
  implementAsync: (local, methods) -> @_expose local, methods, true

  _format: (methods) -> if typeof methods is 'string' then [methods] else methods

  log: (text) -> console.log if text.length < 128 then text else text.substring(0, 127) + ' ...'

#
# Transports: ws, http, socket.io
#
exports.wsRpc = class wsRpc extends Rpc
  constructor: (ws) -> # for convenience purpose
    super()
    if ws and ws.send then @out (msg, message) -> ws.send message, (err) => @log err.toString() if err
    @in ws

  in:  (ws) -> # for convenience purpose
    if ws
      if ws.on
        ws.on 'message', (message, flags) => @process message unless flags.binary
      else
        ws.onmessage = (e) => @process e.data if e.data.length

exports.angularRpc = class angularRpc extends Rpc
  constructor: (http) ->
    super()
    @out (msg, message) -> http.post('/rpc', msg).success (message) => @process message if message

exports.xmlHttpRpc = class xmlHttpRpc extends Rpc # not tested...
  constructor: (xhr) ->
    super()
    @out (msg, message) ->
      xhr.open 'POST', '/rpc', true
      xhr.setRequestHeader 'Content-type', 'application/json'
      xhr.onload => @process xhr.response # or responseText
      xhr.send message

exports.ioRpc = class ioRpc extends Rpc
  constructor: (socket) ->
    super()
    if socket 
      @out (msg, message) -> socket.emit 'rpc', msg
      socket.on 'rpc', (msg) => @process msg
