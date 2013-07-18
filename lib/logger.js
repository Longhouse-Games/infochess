define(['winston'], function(winston) {

  winston.cli();

  var logger = new winston.Logger({
    transports: [
      new winston.transports.Console({level: 'verbose', timestamp: true})
    ]
  });

  logger.cli();

  return logger;
});
