var socketio=require('socket.io');
var io;
var guestNumber= 1;
var nickNames={};
var namesUsed=[];
var currentRoom={};

exports.listen = function(server) 
{

  // Start the Socket.io server, allowing it to piggyback on the existing HTTP server
  io = socketio.listen(server);
  io.set('log level', 1);

  // Define how each user connection will be handled
  io.sockets.on('connection', function (socket) 
  {
    socket.join('Lobby');

    // Place user in the "Lobby" room when they connect
    currentRoom[socket.id] = 'Lobby';
    socket.emit('joinResult', {room: 'Lobby'});

    // Assign user a guest name when they connect
    guestNumber = assignGuestName(
      socket,
      guestNumber,
      nickNames,
      namesUsed );

    // Handle user messages, name change attempts, and room creation/changes.
    handleMessageBroadcasting(socket, nickNames);
    handleNameChangeAttempts(socket, nickNames, namesUsed);
    handleRoomJoining(socket);

    // Provide user with a list of occupied rooms on request.
    socket.on('rooms', function() 
    {
      socket.emit('rooms', io.sockets.manager.rooms);
    });

    // Define "cleanup" logic for when a user disconnects
    handleClientDisconnection(socket, nickNames, namesUsed);
  });
};

function assignGuestName(socket, guestNumber,nickNames,nameUsed)
{
  var name= 'Guest'+guestNumber;
  nickNames[socket.id]=name;

  socket.emit('nameResult',{

    success:true,
    name:name
  });

  namesUsed.push(name);
  return guestNumber+1;
}

function joinRoom(socket,room)
{
  socket.join(room);
  currentRoom[socket.id]=room;
  socket.emit('joinResult',{room:room});
  socket.broadcast.to(room).emit('message',{
    text: nickNames[socket.id]+'has joined'+room+'.'
  });

  var usersInRoom=io.sockets.clients(room);
  if (usersInRoom.lenght >1)
  {
    var usersInRoomSummary='Users currently in '+room+':';

    for (var index in usersInRoom)
    {
      var userSocketId=usersInRoom[index].id;
      if(userSocketId!=socket.id)
      {
        if (index>0)
          usersInRoomSummary+=',';
      }
      usersInRoomSummary+=nickNames[userSocketId];
    }
  }
usersInRoomSummary+='.';
socket.emit('message',{text: usersInRoomSummary});
}

function handleNameChangeAttempts(socket, nickNames, namesUsed) 
{
  // Added listener for nameAttempt events
  socket.on('nameAttempt', function(name) 
  {
  // Don't allow nicknames to begin with "Guest"
    if (name.indexOf('Guest') == 0) 
    {
      socket.emit('nameResult', {
        success: false,
        message: 'Names cannot begin with "Guest".'
      });

    } 
    else 
    {
      // If the name isn't already registered, register it
      if (namesUsed.indexOf(name) == -1) 
      {
        var previousName = nickNames[socket.id];
        namesUsed.push(name);
        nickNames[socket.id] = name;
       
        socket.emit('nameResult', {
          success: true,
          name: name
        });

        socket.broadcast.to(currentRoom[socket.id]).emit('message', {
          text: previousName + ' is now known as ' + name + '.'
        });

      // Send an error to the client if the name's already registered
      }
      else 
      {
        socket.emit('nameResult', {
          success: false,
          message: 'That name is already in use.'
        });
      }
    }
  });
}

function handleMessageBroadcasting(socket, nickNames) 
{
  socket.on('message', function (message) {
    socket.broadcast.to(message.room).emit('message', {
      text: nickNames[socket.id] + ': ' + message.text
    });
  });
}

function handleRoomJoining(socket) 
{
  socket.on('join', function(room) {
    socket.leave(currentRoom[socket.id]);
    socket.join(room.newRoom);
    currentRoom[socket.id] = room.newRoom;
    socket.emit('joinResult', {room: room.newRoom});
  });
}

function handleClientDisconnection(socket, nickNames, namesUsed) {
  socket.on('disconnect', function() {
    var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
    delete namesUsed[nameIndex];
    delete nickNames[socket.id];
  });
}