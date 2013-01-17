var winston = require('winston');

winston.cli();

var logger = new winston.Logger({
  transports: [
    new winston.transports.Console({level: 'verbose', timestamp: true})
  ]
});

logger.cli();

module.exports = logger;
