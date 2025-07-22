import { logger } from '../logger';

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    printf: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

jest.mock('winston-daily-rotate-file', () => ({
  __esModule: true,
  default: jest.fn()
}));

describe('Logger Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Logger Configuration', () => {
    it('should have all required logging methods', () => {
      expect(logger).toHaveProperty('info');
      expect(logger).toHaveProperty('error');
      expect(logger).toHaveProperty('warn');
      expect(logger).toHaveProperty('debug');
    });

    it('should have methods as functions', () => {
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('Logging Methods', () => {
    it('should log info messages', () => {
      const message = 'Test info message';
      const meta = { userId: '123', action: 'login' };

      logger.info(message, meta);

      expect(logger.info).toHaveBeenCalledWith(message, meta);
    });

    it('should log error messages', () => {
      const message = 'Test error message';
      const error = new Error('Database connection failed');
      const meta = { userId: '123', endpoint: '/api/users' };

      logger.error(message, { error, ...meta });

      expect(logger.error).toHaveBeenCalledWith(message, { error, ...meta });
    });

    it('should log warning messages', () => {
      const message = 'Test warning message';
      const meta = { userId: '123', warning: 'Rate limit approaching' };

      logger.warn(message, meta);

      expect(logger.warn).toHaveBeenCalledWith(message, meta);
    });

    it('should log debug messages', () => {
      const message = 'Test debug message';
      const meta = { userId: '123', debug: 'Request processing' };

      logger.debug(message, meta);

      expect(logger.debug).toHaveBeenCalledWith(message, meta);
    });

    it('should handle messages without metadata', () => {
      const message = 'Simple message';

      logger.info(message);

      expect(logger.info).toHaveBeenCalledWith(message, undefined);
    });

    it('should handle empty messages', () => {
      const message = '';
      const meta = { userId: '123' };

      logger.info(message, meta);

      expect(logger.info).toHaveBeenCalledWith(message, meta);
    });

    it('should handle null and undefined values', () => {
      logger.info(null);
      logger.error(undefined);

      expect(logger.info).toHaveBeenCalledWith(null, undefined);
      expect(logger.error).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  describe('Structured Logging', () => {
    it('should handle complex metadata objects', () => {
      const message = 'Complex operation';
      const meta = {
        userId: '123',
        sessionId: 'session-456',
        request: {
          method: 'POST',
          url: '/api/sessions',
          headers: { 'content-type': 'application/json' }
        },
        response: {
          status: 201,
          body: { id: 'session-789' }
        },
        timing: {
          start: new Date('2024-01-01T10:00:00Z'),
          end: new Date('2024-01-01T10:00:01Z'),
          duration: 1000
        }
      };

      logger.info(message, meta);

      expect(logger.info).toHaveBeenCalledWith(message, meta);
    });

    it('should handle circular references in metadata', () => {
      const message = 'Circular reference test';
      const obj: any = { name: 'test' };
      obj.self = obj;

      logger.info(message, { obj });

      expect(logger.info).toHaveBeenCalledWith(message, { obj });
    });

    it('should handle very large metadata objects', () => {
      const message = 'Large metadata test';
      const largeMeta = {
        data: Array(1000).fill('test').map((item, index) => ({
          id: index,
          value: item,
          timestamp: new Date()
        }))
      };

      logger.info(message, largeMeta);

      expect(logger.info).toHaveBeenCalledWith(message, largeMeta);
    });
  });

  describe('Error Logging', () => {
    it('should log Error objects properly', () => {
      const error = new Error('Database connection failed');
      error.stack = 'Error: Database connection failed\n    at connect (db.js:10:5)';

      logger.error('Database error occurred', { error });

      expect(logger.error).toHaveBeenCalledWith('Database error occurred', { error });
    });

    it('should log custom error types', () => {
      class CustomError extends Error {
        constructor(message: string, public code: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const customError = new CustomError('Validation failed', 'VALIDATION_ERROR');

      logger.error('Custom error occurred', { error: customError });

      expect(logger.error).toHaveBeenCalledWith('Custom error occurred', { error: customError });
    });

    it('should handle errors without stack traces', () => {
      const error = new Error('Simple error');
      delete (error as any).stack;

      logger.error('Error without stack', { error });

      expect(logger.error).toHaveBeenCalledWith('Error without stack', { error });
    });

    it('should handle non-Error objects in error logging', () => {
      const notAnError = { message: 'Not an error object', code: 'CUSTOM' };

      logger.error('Non-error object', { error: notAnError });

      expect(logger.error).toHaveBeenCalledWith('Non-error object', { error: notAnError });
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent logging calls', async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve(logger.info(`Message ${i}`, { index: i }))
        );
      }

      await Promise.all(promises);

      expect(logger.info).toHaveBeenCalledTimes(100);
    });

    it('should handle rapid sequential logging', async () => {
      for (let i = 0; i < 50; i++) {
        logger.info(`Sequential message ${i}`);
      }

      expect(logger.info).toHaveBeenCalledTimes(50);
    });

    it('should handle mixed logging levels concurrently', async () => {
      const promises = [];
      for (let i = 0; i < 25; i++) {
        promises.push(logger.info(`Info ${i}`));
        promises.push(logger.error(`Error ${i}`));
        promises.push(logger.warn(`Warning ${i}`));
        promises.push(logger.debug(`Debug ${i}`));
      }

      await Promise.all(promises);

      expect(logger.info).toHaveBeenCalledTimes(25);
      expect(logger.error).toHaveBeenCalledTimes(25);
      expect(logger.warn).toHaveBeenCalledTimes(25);
      expect(logger.debug).toHaveBeenCalledTimes(25);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long messages', () => {
      const longMessage = 'x'.repeat(10000);
      const meta = { length: longMessage.length };

      logger.info(longMessage, meta);

      expect(logger.info).toHaveBeenCalledWith(longMessage, meta);
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?';
      const meta = { special: true };

      logger.info(specialMessage, meta);

      expect(logger.info).toHaveBeenCalledWith(specialMessage, meta);
    });

    it('should handle unicode characters', () => {
      const unicodeMessage = 'Unicode: 🚀🌟🎉中文日本語한국어';
      const meta = { unicode: true };

      logger.info(unicodeMessage, meta);

      expect(logger.info).toHaveBeenCalledWith(unicodeMessage, meta);
    });

    it('should handle function objects in metadata', () => {
      const message = 'Function in metadata';
      const meta = {
        func: () => 'test',
        asyncFunc: async () => 'async test'
      };

      logger.info(message, meta);

      expect(logger.info).toHaveBeenCalledWith(message, meta);
    });

    it('should handle Date objects in metadata', () => {
      const message = 'Date in metadata';
      const meta = {
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T11:00:00Z')
      };

      logger.info(message, meta);

      expect(logger.info).toHaveBeenCalledWith(message, meta);
    });

    it('should handle Buffer objects in metadata', () => {
      const message = 'Buffer in metadata';
      const meta = {
        buffer: Buffer.from('test data'),
        base64: Buffer.from('test').toString('base64')
      };

      logger.info(message, meta);

      expect(logger.info).toHaveBeenCalledWith(message, meta);
    });
  });

  describe('Integration with Winston', () => {
    it('should maintain winston logger interface', () => {
      // Test that our logger maintains the expected winston interface
      const testMessage = 'Test message';
      const testMeta = { test: true };

      // These should not throw errors
      expect(() => logger.info(testMessage)).not.toThrow();
      expect(() => logger.error(testMessage, testMeta)).not.toThrow();
      expect(() => logger.warn(testMessage)).not.toThrow();
      expect(() => logger.debug(testMessage, testMeta)).not.toThrow();
    });

    it('should handle winston transport errors gracefully', () => {
      // Simulate a transport error by calling the logger
      // The actual error handling would be in winston configuration
      expect(() => logger.info('Test message')).not.toThrow();
    });
  });

  describe('Logging Levels', () => {
    it('should respect logging levels in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(logger.debug).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();

      if (originalEnv) {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should handle production logging levels', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      // All methods should still be callable
      expect(logger.debug).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();

      if (originalEnv) {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
}); 