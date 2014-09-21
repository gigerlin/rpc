###
  @author Gilles Gerlinger
  Copyright 2014. All rights reserved.
###

class Local
  constructor: (@local, method, @asynchronous) ->
    @[method] = new Function "args, cb", "return this.local['#{method}'](args, cb);"

class Remote
  constructor: (@rpc, methods) ->
    for method in methods
      @[method] = new Function "args, cb", 
        "if (arguments.length === 1 && typeof args === 'function') { cb = args; args = null}; return this.rpc._request('#{method}', args, cb);"

#
# calls with 0 or one parameter (string, number or object), plus a callback
#
exports.Rpc = class Rpc 

  constructor: -> @id = 0; @locals = []; @callbacks = []

  out: (send) -> @_out = send
  
  _request: (method, args, cb, err) -> # call remote proc

    message = method:method, args:args, err:err
    if cb and typeof cb is 'function'
      @callbacks[cbname = method + " cb#{@id++}"] = cb
      message.cb = cbname

    message = JSON.stringify message
    if @_out
      @log "rpc out #{message}" 
      @_out message 
    else
      @log "no rpc out route defined"
    return message

  reply: (method, args) -> @_request method, args if method # simple alias
  error: (method, args) -> @_request method, args, undefined, true if method

  process: (message) -> # execute local method upon remote request
    @log "rpc in  #{message}"  
    try
      obj = JSON.parse message
      local = @locals[obj.method]
      if local
        rst = local[obj.method] obj.args, obj.cb
        @reply obj.cb, rst unless local.asynchronous
      else if @callbacks[obj.method]
        if obj.err
          @callbacks[obj.method] undefined, obj.args
        else
          @callbacks[obj.method] obj.args
        delete @callbacks[obj.method]
      else 
        message = "error: method #{obj.method} is unknown"
        @log message
        @error obj.cb, message
    catch e
      message = "error in #{obj.method}: #{e}"
      @log message
      @error obj.cb, "error in #{obj.method}: #{e}"

  remote: (methods) -> new Remote @, @_format methods
  _expose: (local, methods, asynchronous) -> # locally checkings can be performed
    for method in @_format methods
      unless local[method]
        @log "warning: object #{local} has no method #{method}"
      else if @locals[method]
        @log "warning: duplicate method #{method}"       
      else 
        @locals[method] = new Local local, method, asynchronous

  implement: (local, methods) -> @_expose local, methods, false
  implementAsync: (local, methods) -> @_expose local, methods, true

  _format: (methods) -> if typeof methods is 'string' then [methods] else methods

  log: (text) -> console.log if text.length < 128 then text else text.substring(0, 127) + ' ...'

exports.wsRpc = class wsRpc extends Rpc
  constructor: (ws) -> # for convenience purpose
    super()
    if ws and ws.send then @out (msg) -> ws.send msg, (err) => @log err.toString() if err
    @in ws

  in:  (ws) -> # for convenience purpose
    if ws
      if ws.on
        ws.on 'message', (message, flags) => @process message unless flags.binary
      else
        ws.onmessage = (e) => @process e.data if e.data.length
