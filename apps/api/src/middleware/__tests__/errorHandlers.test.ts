import { Request, Response, NextFunction } from 'express';
import { 
  asyncHandler, 
  successResponse, 
  ValidationError, 
  NotFoundError,
  errorHandler 
} from '../errorHandlers';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Error Handlers', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      url: '/api/test',
      headers: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('asyncHandler', () => {
    it('should handle successful async operations', async () => {
      const asyncFunction = jest.fn().mockResolvedValue('success');
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(mockReq as Request, mockRes as Response, mockNext);

      expect(asyncFunction).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch and forward errors to next middleware', async () => {
      const error = new Error('Test error');
      const asyncFunction = jest.fn().mockRejectedValue(error);
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(mockReq as Request, mockRes as Response, mockNext);

      expect(asyncFunction).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle ValidationError specifically', async () => {
      const validationError = new ValidationError('Invalid input');
      const asyncFunction = jest.fn().mockRejectedValue(validationError);
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(validationError);
    });

    it('should handle NotFoundError specifically', async () => {
      const notFoundError = new NotFoundError('Resource not found');
      const asyncFunction = jest.fn().mockRejectedValue(notFoundError);
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(notFoundError);
    });

    it('should handle synchronous errors', async () => {
      const error = new Error('Sync error');
      const syncFunction = jest.fn().mockImplementation(() => {
        throw error;
      });
      const wrappedFunction = asyncHandler(syncFunction);

      await wrappedFunction(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle non-Error objects', async () => {
      const nonError = 'String error';
      const asyncFunction = jest.fn().mockRejectedValue(nonError);
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(nonError);
    });
  });

  describe('successResponse', () => {
    it('should send successful response with data', () => {
      const data = { id: 1, name: 'Test' };
      const message = 'Success message';

      successResponse(mockRes as Response, data, message);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
        message
      });
    });

    it('should send successful response without data', () => {
      const message = 'Success message';

      successResponse(mockRes as Response, null, message);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: null,
        message
      });
    });

    it('should send response with custom status code', () => {
      const data = { id: 1 };
      const message = 'Created successfully';
      const statusCode = 201;

      successResponse(mockRes as Response, data, message, statusCode);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
        message
      });
    });

    it('should handle undefined message', () => {
      const data = { id: 1 };

      successResponse(mockRes as Response, data);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
        message: undefined
      });
    });

    it('should handle complex data structures', () => {
      const complexData = {
        users: [
          { id: 1, name: 'User 1' },
          { id: 2, name: 'User 2' }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2
        },
        metadata: {
          timestamp: new Date(),
          version: '1.0.0'
        }
      };

      successResponse(mockRes as Response, complexData, 'Complex data retrieved');

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: complexData,
        message: 'Complex data retrieved'
      });
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with message', () => {
      const message = 'Invalid email format';
      const error = new ValidationError(message);

      expect(error.message).toBe(message);
      expect(error.name).toBe('ValidationError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should create ValidationError without message', () => {
      const error = new ValidationError();

      expect(error.message).toBe('Validation failed');
      expect(error.name).toBe('ValidationError');
    });

    it('should be throwable and catchable', () => {
      const message = 'Custom validation error';
      
      expect(() => {
        throw new ValidationError(message);
      }).toThrow(ValidationError);

      try {
        throw new ValidationError(message);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toBe(message);
      }
    });
  });

  describe('NotFoundError', () => {
    it('should create NotFoundError with message', () => {
      const message = 'User not found';
      const error = new NotFoundError(message);

      expect(error.message).toBe(message);
      expect(error.name).toBe('NotFoundError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should create NotFoundError without message', () => {
      const error = new NotFoundError();

      expect(error.message).toBe('Resource not found');
      expect(error.name).toBe('NotFoundError');
    });

    it('should be throwable and catchable', () => {
      const message = 'Custom not found error';
      
      expect(() => {
        throw new NotFoundError(message);
      }).toThrow(NotFoundError);

      try {
        throw new NotFoundError(message);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundError);
        expect((error as NotFoundError).message).toBe(message);
      }
    });
  });

  describe('errorHandler', () => {
    it('should handle ValidationError with 400 status', () => {
      const error = new ValidationError('Invalid input data');
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid input data',
        code: 'VALIDATION_ERROR'
      });
    });

    it('should handle NotFoundError with 404 status', () => {
      const error = new NotFoundError('User not found');
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
        code: 'NOT_FOUND'
      });
    });

    it('should handle generic Error with 500 status', () => {
      const error = new Error('Internal server error');
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    });

    it('should handle errors without message', () => {
      const error = new Error();
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    });

    it('should handle non-Error objects', () => {
      const nonError = 'String error';
      
      errorHandler(nonError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    });

    it('should handle null and undefined errors', () => {
      errorHandler(null as any, mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(500);

      errorHandler(undefined as any, mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should handle custom error types', () => {
      class CustomError extends Error {
        constructor(message: string, public statusCode: number = 500) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const customError = new CustomError('Custom error message', 422);
      
      errorHandler(customError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500); // Should default to 500
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Custom error message',
        code: 'INTERNAL_ERROR'
      });
    });

    it('should handle errors with additional properties', () => {
      const error = new Error('Database error');
      (error as any).code = 'DB_CONNECTION_FAILED';
      (error as any).details = { host: 'localhost', port: 5432 };
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error',
        code: 'INTERNAL_ERROR'
      });
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle asyncHandler with multiple async operations', async () => {
      const asyncFunction = jest.fn().mockImplementation(async () => {
        await Promise.resolve('step1');
        await Promise.resolve('step2');
        return 'final result';
      });
      
      const wrappedFunction = asyncHandler(asyncFunction);
      
      await wrappedFunction(mockReq as Request, mockRes as Response, mockNext);
      
      expect(asyncFunction).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle asyncHandler with nested errors', async () => {
      const asyncFunction = jest.fn().mockImplementation(async () => {
        try {
          await Promise.resolve('step1');
          throw new Error('Nested error');
        } catch (error) {
          throw new ValidationError('Wrapped validation error');
        }
      });
      
      const wrappedFunction = asyncHandler(asyncFunction);
      
      await wrappedFunction(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should handle response already sent scenario', () => {
      const error = new ValidationError('Test error');
      mockRes.headersSent = true;
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should handle response methods throwing errors', () => {
      const error = new ValidationError('Test error');
      mockRes.status = jest.fn().mockImplementation(() => {
        throw new Error('Status method error');
      });
      
      expect(() => {
        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      }).toThrow('Status method error');
    });

    it('should handle very long error messages', () => {
      const longMessage = 'x'.repeat(10000);
      const error = new Error(longMessage);
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: longMessage,
        code: 'INTERNAL_ERROR'
      });
    });

    it('should handle circular reference errors', () => {
      const error = new Error('Circular reference');
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      (error as any).circular = circularObj;
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Circular reference',
        code: 'INTERNAL_ERROR'
      });
    });
  });

  describe('Integration Tests', () => {
    it('should work with Express middleware chain', async () => {
      const asyncRoute = asyncHandler(async (req: Request, res: Response) => {
        const data = { id: 1, name: 'Test' };
        successResponse(res, data, 'Success');
      });
      
      await asyncRoute(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 1, name: 'Test' },
        message: 'Success'
      });
    });

    it('should handle error in Express middleware chain', async () => {
      const asyncRoute = asyncHandler(async (req: Request, res: Response) => {
        throw new ValidationError('Invalid input');
      });
      
      await asyncRoute(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should maintain consistent error response format', () => {
      const errorTypes = [
        new ValidationError('Validation failed'),
        new NotFoundError('Not found'),
        new Error('Generic error')
      ];
      
      errorTypes.forEach(error => {
        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
        
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: expect.any(String),
            code: expect.any(String)
          })
        );
        
        jest.clearAllMocks();
      });
    });
  });
}); 