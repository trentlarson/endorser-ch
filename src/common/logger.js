const pino = require('pino');

const l = pino({
  name: process.env.APP_ID || 'endorser-ch',
  level: process.env.LOG_LEVEL || 'error',
  prettyPrint: {translateTime: true}
});

module.exports = l;
