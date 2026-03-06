const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const cluster = require('cluster');
const process = require('process');

const process_pid = () => {
  if (cluster.isPrimary) {
    return `[${process.pid} P]`;
  } else {
    return `[${process.pid}]`;
  }
};

var info = winston.createLogger({
  format: winston.format.combine(
    winston.format.splat(),
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf((log) => {
          if (log.stack) return `[${log.timestamp}] ${process_pid()} [${log.level}] ${log.stack}`;
          return `[${log.timestamp}] ${process_pid()} [${log.level}] ${log.message}`;
        })
      ),
    }),
    new winston.transports.DailyRotateFile({
      level: 'info',
      filename: '%DATE%_infos.log',
      dirname: path.join(__dirname, '../logs'),
      datePattern: 'YYYY-MM-DD',
      format: winston.format.combine(
        winston.format.printf((log) => {
          if (log.stack) return `[${log.timestamp}] ${process_pid()} [${log.level}] ${log.stack}`;
          return `[${log.timestamp}] ${process_pid()} [${log.level}] ${log.message}`;
        })
      ),
      maxSize: '100m',
      maxFiles: '180d',
    }),
    new winston.transports.DailyRotateFile({
      level: 'error',
      filename: '%DATE%_errors.log',
      dirname: path.join(__dirname, '../logs'),
      datePattern: 'YYYY-MM-DD',
      format: winston.format.combine(
        winston.format.printf((log) => {
          if (log.stack) return `[${log.timestamp}] ${process_pid()} [${log.level}] ${log.stack}`;
          return `[${log.timestamp}] ${process_pid()} [${log.level}] ${log.message}`;
        })
      ),
      maxSize: '100m',
      maxFiles: '180d',
    }),
  ],
});

var http = winston.createLogger({
  format: winston.format.combine(
    winston.format.splat(),
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    })
  ),
  transports: [
    new winston.transports.DailyRotateFile({
      level: 'info',
      filename: '%DATE%_https.log',
      dirname: path.join(__dirname, '../logs'),
      datePattern: 'YYYY-MM-DD',
      format: winston.format.combine(
        winston.format.printf((log) => {
          if (log.stack) return `[${log.timestamp}] ${process_pid()} [${log.level}] ${log.stack}`;
          return `[${log.timestamp}] ${process_pid()} [${log.level}] ${log.message}`;
        })
      ),
      maxSize: '100m',
      maxFiles: '180d',
    }),
  ],
});

module.exports = {
  info: (message, cb) => {
    info.info(message, cb);
  },
  error: (message, cb) => {
    info.error(message, cb);
  },
  http: (message, cb) => {
    http.info(message, cb);
  },
  http_error: (message, cb) => {
    http.error(message, cb);
  },
};
