var rpc = require('./avs-rpc');

// side A

var sideA = new rpc.Rpc;

var remote = sideA.remote('getUserProfile', 'getUserList');

// side B

function getUserProfile(name) { return {name:name, age:32}; }

var local = {}; // interface declaration
local.getUserProfile = getUserProfile;

var sideB = new rpc.Rpc;
sideB.implement(local);

// Simulate network

sideA.out(function(msg) {sideB.process(msg);});
sideB.out(function(msg) {sideA.process(msg);});

// Demonstrate

remote.getUserProfile('gilles', function(user, err){
  if (err)
    console.log("remote error in getUserProfile: " + err);
  else
    console.log("name: " + user.name + " age: " + user.age);
});

// socket.io example

io = require('socket.io');

// side B

function getUserProfile(name) { return {name:name, age:32}; }

local = {}; // interface declaration
local.getUserProfile = getUserProfile;

var ioB = io(4141);
ioB.on('connection', function(socket) {
  console.log("NEW connection");
  sideB = new rpc.ioRpc(socket);
  sideB.implement(local);
}); 

//Side A

var ioA = require('socket.io-client')('http://localhost:4141');

sideA = new rpc.ioRpc(ioA);
remote = sideA.remote(['getUserProfile', 'getUserList']);

remote.getUserProfile('gilles', function(user, err){
  if (err)
    console.log("remote error in getUserProfile: " + err);
  else
    console.log("name: " + user.name + " age: " + user.age);
});

remote.getUserList();


