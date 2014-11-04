
# avs-rpc: a node.js rpc library #

Elegant Javascript rpc mechanism

## Install ##

`npm install avs-rpc`

## Usage ##

Side A needs side B to do some stuff...

### Side A ###
First, create a RPC object from the library. Use its *remote* method to create a remote object and declare its remote methods. Then use the remote object.

```js
var rpc = require('./avs-rpc');

var sideA = new rpc.Rpc;

var remote = sideA.remote(['getUserProfile', 'getUserList']);

remote.getUserProfile('gilles', function(user, err){
  if (err)
    console.log("Error in remote getUserProfile: " + err);
  else
    console.log("name: " + user.name + " age: " + user.age);
});
```
### Side B ###

Obviously, we need a function to implement the *getUserProfile* requested on side A.
```js
function getUserProfile(name) { return {name:name, age:32}; }
```

We need now to make this function available to side A. This is done by creating an object to hold the interface (to the functions to publish), and by linking this object to the side B rpc object.

```js
var local = {};
local.getUserProfile = getUserProfile;

var sideB = new rpc.Rpc;
sideB.implement(local);
```

From then, *remote.getUserProfile(...)* on side A will trigger *getUserProfile* on side B and value returned by side B will be sent back to side A.

### Transport ###

The rpc objects we created on both sides expect that we define a way to transport the information from one side to the other. The simplest way to do that is to use the *out* method of the rpc object.

```js
sideA.out(function(msg) { sideB.process(msg); });
sideB.out(function(msg) { sideA.process(msg); });
```

However, it is rather meant to be used with network transport. Next section describes how to use socket.io. 

### socket.io ###
The avs-rpc package supports the socket.io library through the ioRpc class (cf. http://socket.io/).

Below is a complete example.

#### Side A ####

```js
var ioA = require('socket.io-client')('http://localhost:4141');

var sideA = new rpc.ioRpc(ioA);
remote = sideA.remote(['getUserProfile', 'getUserList']);

remote.getUserProfile('gilles', function(user, err){
  if (err)
    console.log("remote error in getUserProfile: " + err);
  else
    console.log("name: " + user.name + " age: " + user.age);
});
```
#### Side B ####

```js
function getUserProfile(name) { return {name:name, age:32}; }
var local = {}; // interface declaration
local.getUserProfile = getUserProfile;

var io = require('socket.io');

var ioB = io(4141);
ioB.on('connection', function(socket) {
  console.log("NEW connection");
  var sideB = new rpc.ioRpc(socket);
  sideB.implement(local);
}); 
```

### Miscellaneous ###

avs-rpc accepts passing any number of arguments to the remote object (as long as they can be JSON stringified). 
If a callback is needed, the callback must be the last (or the only one) argument (see example above).

The local object in the example may be used to publish several functions, e.g.:
```js
var local = {}; // interface declaration
local.getUserProfile = getUserProfile;
local.getUserProfile = getUserList;
...
sideB.implement(local);
```

Local functions can be synchronous, meaning that the value returned is implicitly sent back to the caller, or asynchronous. For asynchronous functions, a callback is provided by avs-rpc so that the function result can be sent back to the caller.

Example: use of *implementAsync*
```js
function getUserList(callback) { 
  //build list of users...
  callback(list); // send back the list when it is ready
  //do other stuff
}

var local = {}; // interface declaration
local.getUserProfile = getUserList;
sideB.implementAsync(local);
```


### Error handling ###
rpc callbacks receive two arguments: a return value and an error value *(result, error)*. If the error value is not undefined, it contains the error message and in this case the return value is undefined (see first example on top of the page).

## License ##

The MIT License (MIT)

Copyright (c) 2014 gigerlin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
