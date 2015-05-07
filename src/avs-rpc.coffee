###
  @author Gilles Gerlinger
  Copyright 2014. All rights reserved.
###
json = require 'circular-json'

class Local
  constructor: (local, method, @asynchronous) ->
    @[method] = (id, args, cb) => 
      console.log "rpc #{id}: executing local #{method} - asynchronous: #{@asynchronous}"
      local[method] args..., cb

class Remote
  constructor: (rpc, methods...) ->
    count = 0
    uid = (Math.random() + '').substring 2, 8
    ( (method) => @[method] = -> 
      args = Array.prototype.slice.call arguments # transform arguments into array
      cb = args.pop() if typeof args[args.length-1] is 'function' 
      rpc._request method:method, args:args, cb:cb, id:"#{uid}-#{++count}" if rpc
    ) method for method in methods

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

  _reply: (msg, args) -> @_request method:msg.cb, args:args, id:msg.id if msg.cb            # simple alias
  _error: (msg, args) -> @_request method:msg.cb, args:args, err:true, id:msg.id if msg.cb  # simple alias

  process: (message) -> # execute local method upon remote request
    try
      if typeof message is 'string' then msg = json.parse message else message = json.stringify msg = message

      unless msg and msg.method
        @log args = "rpc error: message is null"
        @_error method:'missing', args
        return

      local = @locals[msg.method]
      @log "rpc #{msg.id}: in  #{message}"  

      if local # LOCAL
        if local.asynchronous # provide a callback
          local[msg.method] msg.id, msg.args, (rst, err) => 
            if err then @_error msg, err else @_reply msg, rst
        else # send back the returned value
          @_reply msg, local[msg.method] msg.id, msg.args

      else if @callbacks[msg.method] # CALLBACK
        if msg.err then err = msg.args else rst = msg.args 
        @callbacks[msg.method] rst, err
        delete @callbacks[msg.method]

      else 
        @log args = "error: method #{msg.method} is unknown"
        @_error msg, args
    catch e
      @log args = "error in #{msg.method}: #{e}"
      @_error msg, args

  _splat: (args...) -> 
    if arguments.length is 1 and typeof arguments[0] isnt 'string' then arguments[0] else args # for compatibility reasons

  remote: (methods...) -> new Remote @, @_splat(methods...)...

  implement: (local, methods...) -> @_expose local, false, @_splat(methods...)...
  implementAsync: (local, methods...) -> @_expose local, true, @_splat(methods...)...
  _expose: (local, asynchronous, methods...) -> 
    unless methods.length # inspect the local object if no methods are provided
      for method of local
        methods.push method if typeof local[method] is 'function' and method.charAt(0) isnt '_' # discard private methods
      @log "rpc methods found: #{methods}"
    for method in methods
      unless local[method]
        @log "rpc warning: local object has no method #{method}"
      else
        @log "rpc warning: duplicate method #{method}, now asynchronous: #{asynchronous}" if @locals[method]
        @locals[method] = new Local local, method, asynchronous

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

#
# class ioRpc extends Rpc to inherit remote and implement methods
#
exports.ioRpc = class ioRpc extends Rpc # inspired from minimum-rpc
  constructor: (@socket, @tag = 'rpc') -> 
    @locals = []
    if @socket then @socket.on @tag, (message, ack_cb) => @process message, ack_cb

  _request: (msg) ->
    @log "rpc #{msg.id}: out #{@tag} #{message = json.stringify msg}"
    if @socket then @socket.emit @tag, message, -> msg.cb.apply @, arguments if msg.cb

  process: (message, ack_cb) ->
    msg = json.parse message
    @log "rpc #{msg.id}: in  #{@tag} #{message}"  

    if local = @locals[msg.method]
      try
        args = msg.args or []
        args.push => ack_cb.apply @, arguments
        if local.asynchronous then local[msg.method] msg.id, args else ack_cb local[msg.method] msg.id, args
      catch e
        @log args = "error in #{msg.method}: #{e}"
        ack_cb null, args
    else
        @log args = "error: method #{msg.method} is unknown"
        ack_cb null, args

#
# class scRpc extends ioRpc
#
exports.scRpc = class scRpc extends ioRpc
  process: (message, ack_cb) ->
    msg = json.parse message
    @log "rpc #{msg.id}: in  #{@tag} #{message}"

    if local = @locals[msg.method]
      try
        args = msg.args or []
        args.push => ack_cb.apply @, arguments
        if local.asynchronous then local[msg.method] msg.id, args else ack_cb null, local[msg.method] msg.id, args
      catch e
        @log args = "error in #{msg.method}: #{e}"
        ack_cb args
    else
        @log args = "error: method #{msg.method} is unknown"
        ack_cb args
