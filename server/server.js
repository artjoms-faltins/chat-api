#!/usr/bin/env node
'use strict'
const env = require('./env');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.prettyPrint(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({ filename: './error.log', level: 'error', timestamp: true }),
    new winston.transports.File({ filename: './combined.log', timestamp: true })
  ]
});
if (env.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
    timestamp: true
  }));
}
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const userSocketHandler = require('./lib/userSocketHandler');
userSocketHandler.init(server);

const onError = error => {
  if (error.syscall !== 'listen') {
    logger.error(error);
    throw error;
  }

  const bind = 'Port ' + env.port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      logger.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      logger.error(error);
      throw error;
  }
}

const onListening = () => {
  const addr = server.address();
  const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
  logger.info('Listening on ' + bind);
}

const shutdown = () => {
  logger.info('Server shutting down...');
  userSocketHandler.getUserSocketMap().forEach((socket) => {
    socket.emit('custom_error', 'Server shutting down');
    socket.disconnect(true);
  });
  server.close(function () {//TODO check this
    process.exit(0);
  });
};

server.listen(env.port, () => {
  logger.info(`Server listening at port: ${env.port}`);
});

server.on('error', onError);
server.on('listening', onListening);

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('uncaughtException', err => {
  logger.error(JSON.stringify(err.stack, null, 2));
  logger.error(err.message);
  process.exit(1)
});