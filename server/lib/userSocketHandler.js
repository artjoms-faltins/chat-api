'use strict';
const winston = require('winston');
const env = require('../env');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.prettyPrint(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({ filename: './sockets.log' })
  ]
});
if (env.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
const userSocketMap = new Map();

const formatUsername = username => {
  return username.toLowerCase();
}
const isUsernameTaken = (username) => {
  return userSocketMap.has(formatUsername(username));
}
const addUser = (username, socket) => {
  const formattedUsername = formatUsername(username);
  userSocketMap.set(formattedUsername, socket);
}
const removeUser = (username) => {
  const formattedUsername = formatUsername(username)
  userSocketMap.delete(formattedUsername);
}
const getUserSocketMap = () => {
  return userSocketMap;
}

const updateInactivityKicker = socket => {
  if (!env.inactivityTimeOut) {
    return;
  }
  clearInterval(socket.inactivityInerval);
  socket.lastActivity = Date.now();

  socket.inactivityInerval = setInterval(() => {
    const now = Date.now();
    if (now - socket.lastActivity > env.inactivityTimeOut) {
      removeUser(socket.username);
      socket.emit('custom_error', 'Disconnected by the server due to inactivity.');
      socket.broadcast.emit('userLeft', {
        reason: `${socket.username} Disconnected due inactivity`,
        username: socket.username,
        time: now
      });
      socket.disconnectReasonBroadcasted = true;
      socket.disconnect(true);
      clearInterval(socket.inactivityInerval);
    }
  }, env.inactivityTimeOut + 1);
}

const init = (server) => {
  const io = require('socket.io')(server, {
    pingInterval: parseInt(env.inactivityTimeout / 2),
    pingTimeout: env.inactivityTimeout,
  });

  io.on('connection', socket => {
    socket.on('error', error => {
      logger.error(error.message);
    });
    socket.on('message', message => {
      if (typeof message !== 'string') {
        return;
      }
      updateInactivityKicker(socket);

      socket.broadcast.emit('message', {
        username: socket.username,
        message: message,
        time: Date.now()
      });
    });

    socket.on('newUser', username => {
      if (typeof username !== 'string') {
        return;
      }
      username = username.trim();
      if (username.length < 3 || username.length > 25) {
        socket.emit('custom_error', 'Username should be between 3 and 25 character length');
        return socket.disconnect(true);
      } else if (!/^[a-z0-9 ]+$/i.test(username)) {
        socket.emit('custom_error', 'Username should contain only character numbers and spaces');
        return socket.disconnect(true);
      } else if (isUsernameTaken(username)) {
        socket.emit('custom_error', 'Username already taken');
        return socket.disconnect(true);
      } else {
        logger.info(`User ${username} joined`);
        addUser(username, socket);
        socket.username = username;
        socket.emit('login_successful', username);
        socket.broadcast.emit('newUserJoined', {
          username,
          time: Date.now()
        });
        updateInactivityKicker(socket);
      }
    });

    socket.on('disconnect', reason => {
      if (!socket.username || socket.disconnectReasonBroadcasted) {
        return;
      }

      let message;
      switch (reason) {
        case 'ping timeout':
          message = `${socket.username} left the chat, connection lost`;
          break;
        case 'transport error':
          message = `${socket.username} left the chat, connection lost`;
          break;
        case 'server namespace disconnect':
        case 'client namespace disconnect':
        case 'transport close':
          message = `${socket.username} left the chat`;
          break;
        default:
          message = `${socket.username} left the chat`;
          logger.error('Unknown disconnect reason: ' + reason);
      }
      removeUser(socket.username);
      socket.broadcast.emit('userLeft', {
        reason: message,
        username: socket.username,
        time: Date.now()
      });
      socket.disconnect(true);
      logger.info(`User ${message}`);
    });
  });
}

module.exports = {
  init,
  getUserSocketMap
};