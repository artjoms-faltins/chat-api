'use strict';

module.exports = {
    inactivityTimeOut: process.env.INACTIVITY_TIMEOUT || 180000,
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT) || 3000
};