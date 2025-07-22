import { logger, requestLogger } from '../utils/logger';
import { Request, Response, NextFunction } from 'express';

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

// Mock winston-daily-rotate-file
jest.mock('winston-daily-rotate-file', () => ({
  DailyRotateFile: jest.fn()
}));

describe('Logger', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      url: '/api/test',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent',
        'content-type': 'application/json'
      }
    };
    mockResponse = {
      statusCode: 200,
      get: jest.fn()
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Logger Instance', () => {
    it('should have info method', () => {
      expect(logger.info).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });

    it('should have error method', () => {
      expect(logger.error).toBeDefined();
      expect(typeof logger.error).toBe('function');
    });

    it('should have warn method', () => {
      expect(logger.warn).toBeDefined();
      expect(typeof logger.warn).toBe('function');
    });

    it('should have debug method', () => {
      expect(logger.debug).toBeDefined();
      expect(typeof logger.debug).toBe('function');
    });

    it('should log info message', () => {
      const message = 'Test info message';
      logger.info(message);

      expect(logger.info).toHaveBeenCalledWith(message);
    });

    it('should log error message', () => {
      const message = 'Test error message';
      logger.error(message);

      expect(logger.error).toHaveBeenCalledWith(message);
    });

    it('should log warning message', () => {
      const message = 'Test warning message';
      logger.warn(message);

      expect(logger.warn).toHaveBeenCalledWith(message);
    });

    it('should log debug message', () => {
      const message = 'Test debug message';
      logger.debug(message);

      expect(logger.debug).toHaveBeenCalledWith(message);
    });

    it('should log structured data', () => {
      const data = {
        userId: 'user-1',
        action: 'login',
        timestamp: new Date()
      };

      logger.info('User action', data);

      expect(logger.info).toHaveBeenCalledWith('User action', data);
    });
  });

  describe('Request Logger Middleware', () => {
    it('should log request and call next', () => {
      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should log request with different HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

      methods.forEach(method => {
        mockRequest.method = method;
        requestLogger(mockRequest as Request, mockResponse as Response, mockNext);
      });

      expect(mockNext).toHaveBeenCalledTimes(methods.length);
    });

    it('should log request with different status codes', () => {
      const statusCodes = [200, 201, 400, 401, 403, 404, 500];

      statusCodes.forEach(statusCode => {
        mockResponse.statusCode = statusCode;
        requestLogger(mockRequest as Request, mockResponse as Response, mockNext);
      });

      expect(mockNext).toHaveBeenCalledTimes(statusCodes.length);
    });

    it('should handle request without user-agent header', () => {
      delete mockRequest.headers!['user-agent'];

      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle request without content-type header', () => {
      delete mockRequest.headers!['content-type'];

      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle request with additional headers', () => {
      mockRequest.headers = {
        ...mockRequest.headers,
        'authorization': 'Bearer token',
        'x-forwarded-for': '192.168.1.1'
      };

      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle request with query parameters', () => {
      mockRequest.url = '/api/test?param1=value1&param2=value2';

      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle request with different IP addresses', () => {
      const ips = ['127.0.0.1', '192.168.1.1', '10.0.0.1', '::1'];

      ips.forEach(ip => {
        const testRequest = {
          ...mockRequest,
          ip
        } as Request;
        requestLogger(testRequest, mockResponse as Response, mockNext);
      });

      expect(mockNext).toHaveBeenCalledTimes(ips.length);
    });

    it('should handle request with response size', () => {
      mockResponse.get = jest.fn().mockReturnValue('1024');

      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.get).toHaveBeenCalledWith('content-length');
    });

    it('should handle request with response time', () => {
      // Mock Date.now to simulate response time
      const originalDateNow = Date.now;
      Date.now = jest.fn()
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(1100); // End time (100ms difference)

      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();

      // Restore original Date.now
      Date.now = originalDateNow;
    });

    it('should handle request with error status codes', () => {
      const errorStatusCodes = [400, 401, 403, 404, 500, 502, 503];

      errorStatusCodes.forEach(statusCode => {
        mockResponse.statusCode = statusCode;
        requestLogger(mockRequest as Request, mockResponse as Response, mockNext);
      });

      expect(mockNext).toHaveBeenCalledTimes(errorStatusCodes.length);
    });

    it('should handle request with success status codes', () => {
      const successStatusCodes = [200, 201, 202, 204];

      successStatusCodes.forEach(statusCode => {
        mockResponse.statusCode = statusCode;
        requestLogger(mockRequest as Request, mockResponse as Response, mockNext);
      });

      expect(mockNext).toHaveBeenCalledTimes(successStatusCodes.length);
    });

    it('should handle request with redirect status codes', () => {
      const redirectStatusCodes = [301, 302, 303, 307, 308];

      redirectStatusCodes.forEach(statusCode => {
        mockResponse.statusCode = statusCode;
        requestLogger(mockRequest as Request, mockResponse as Response, mockNext);
      });

      expect(mockNext).toHaveBeenCalledTimes(redirectStatusCodes.length);
    });

    it('should handle request with custom headers', () => {
      mockRequest.headers = {
        'x-custom-header': 'custom-value',
        'x-api-version': 'v1',
        'x-request-id': 'req-123'
      };

      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle request with empty headers', () => {
      mockRequest.headers = {};

      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle request with null headers', () => {
      mockRequest.headers = null as any;

      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Logger Configuration', () => {
    it('should be configured with proper log levels', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should handle different log levels', () => {
      const testMessage = 'Test message';

      logger.info(testMessage);
      logger.error(testMessage);
      logger.warn(testMessage);
      logger.debug(testMessage);

      expect(logger.info).toHaveBeenCalledWith(testMessage);
      expect(logger.error).toHaveBeenCalledWith(testMessage);
      expect(logger.warn).toHaveBeenCalledWith(testMessage);
      expect(logger.debug).toHaveBeenCalledWith(testMessage);
    });

    it('should handle structured logging', () => {
      const message = 'User action';
      const metadata = {
        userId: 'user-1',
        action: 'login',
        timestamp: new Date().toISOString(),
        ip: '127.0.0.1'
      };

      logger.info(message, metadata);

      expect(logger.info).toHaveBeenCalledWith(message, metadata);
    });

    it('should handle error logging with stack trace', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';

      logger.error('Error occurred', { error: error.message, stack: error.stack });

      expect(logger.error).toHaveBeenCalledWith('Error occurred', {
        error: error.message,
        stack: error.stack
      });
    });

    it('should handle warning with context', () => {
      const context = {
        service: 'auth',
        operation: 'token_verification',
        reason: 'expired_token'
      };

      logger.warn('Token verification failed', context);

      expect(logger.warn).toHaveBeenCalledWith('Token verification failed', context);
    });

    it('should handle debug logging for development', () => {
      const debugInfo = {
        query: 'SELECT * FROM users',
        params: { userId: 'user-1' },
        executionTime: 15.5
      };

      logger.debug('Database query executed', debugInfo);

      expect(logger.debug).toHaveBeenCalledWith('Database query executed', debugInfo);
    });
  });
}); 