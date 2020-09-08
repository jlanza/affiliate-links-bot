const { createLogger, format, transports } = require('winston');
// const DailyRotateFile = require('winston-daily-rotate-file');

const level = process.env.LOG_LEVEL || 'debug';

// Enable exception handling when you create your logger.
export const logger = createLogger({
  transports: [
    new transports.Console({
      level,
      format: format.combine(
        format.timestamp({format:'YYYY-MM-DD HH:mm:ss.SSS'}),
        format.align(),
        format.printf((info: any) => `${info.timestamp} ${info.level}: ${info.message}`)
      ),
      handleExceptions: true
    }),
  ],
});

// export const logger = winston.createLogger({
//   transports: [
//     new winston.transports.Console({ level: 'info', timestamp: true }),
//     new DailyRotateFile({
//       filename: config.logFile,
//       level: config.logLevel,
//       timestamp: true,
//     }),
//   ],
//   exceptionHandlers: [
//     new winston.transports.Console({ level: 'info', timestamp: true }),
//     new DailyRotateFile({
//       filename: config.logFile,
//       level: config.logLevel,
//       timestamp: true,
//     }),
//   ],
// });
