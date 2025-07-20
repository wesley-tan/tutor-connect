import winston from 'winston';

const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug');

// Custom format for development
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// JSON format for production
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger
export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: NODE_ENV === 'production' ? productionFormat : developmentFormat,
  defaultMeta: {
    service: 'tutorconnect-api',
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      stderrLevels: ['error']
    })
  ]
});

// Add file transports in production
if (NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));

  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
}

// Helper functions for structured logging
export const logHelpers = {
  // User action logging
  userAction: (userId: string, action: string, metadata?: any) => {
    logger.info('User action', {
      userId,
      action,
      ...metadata
    });
  },

  // API request logging
  apiRequest: (method: string, url: string, userId?: string, duration?: number) => {
    logger.info('API request', {
      method,
      url,
      userId,
      duration
    });
  },

  // Database query logging
  dbQuery: (operation: string, table: string, duration?: number, error?: Error) => {
    if (error) {
      logger.error('Database query failed', {
        operation,
        table,
        duration,
        error: error.message,
        stack: error.stack
      });
    } else {
      logger.debug('Database query', {
        operation,
        table,
        duration
      });
    }
  },

  // Security event logging
  securityEvent: (event: string, ip: string, userAgent?: string, userId?: string) => {
    logger.warn('Security event', {
      event,
      ip,
      userAgent,
      userId
    });
  },

  // Payment logging
  payment: (event: string, paymentId: string, amount?: number, currency?: string, error?: Error) => {
    const logData = {
      event,
      paymentId,
      amount,
      currency
    };

    if (error) {
      logger.error('Payment error', {
        ...logData,
        error: error.message,
        stack: error.stack
      });
    } else {
      logger.info('Payment event', logData);
    }
  },

  // External API logging
  externalApi: (service: string, operation: string, duration?: number, error?: Error) => {
    const logData = {
      service,
      operation,
      duration
    };

    if (error) {
      logger.error('External API error', {
        ...logData,
        error: error.message,
        stack: error.stack
      });
    } else {
      logger.debug('External API call', logData);
    }
  }
};

export default logger; 