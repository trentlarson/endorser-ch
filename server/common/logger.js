const pino = require('pino');

const l = pino({
  name: process.env.APP_ID,
  level: process.env.LOG_LEVEL,
  prettyPrint: {translateTime: true}
});

module.exports = l;
