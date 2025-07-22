import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import {
  errorHandler,
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  successResponse,
  paginatedResponse
} from '../errorHandlers';

// Mock Express response
const mockResponse = () => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
  return res as Response;
};

// Mock Express request
const mockRequest = () => {
  const req: Partial<Request> = {
    path: '/test',
    method: 'GET',
    ip: '127.0.0.1'
  };
  return req as Request;
};

describe('Error Handlers', () => {
  let req: Request;
  let res: Response;
  let next: jest.Mock;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = jest.fn();
  });

  describe('AppError', () => {
    it('should create custom error with correct properties', () => {
      const error = new AppError(400, 'TEST_ERROR', 'Test message', { field: 'test' });
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test message');
      expect(error.details).toEqual({ field: 'test' });
    });
  });

  describe('errorHandler', () => {
    it('should handle AppError', () => {
      const error = new AppError(400, 'TEST_ERROR', 'Test message');
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TEST_ERROR',
          message: 'Test message',
          details: undefined
        }
      });
    });

    it('should handle AuthenticationError', () => {
      const error = new AuthenticationError();
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication failed',
          details: undefined
        }
      });
    });

    it('should handle AuthorizationError', () => {
      const error = new AuthorizationError();
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Not authorized',
          details: undefined
        }
      });
    });

    it('should handle ValidationError', () => {
      const error = new ValidationError('Invalid input', { field: 'required' });
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: { field: 'required' }
        }
      });
    });

    it('should handle NotFoundError', () => {
      const error = new NotFoundError('User');
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
          details: undefined
        }
      });
    });

    it('should handle ZodError', () => {
      const schema = z.object({
        name: z.string()
      });
      const result = schema.safeParse({ name: 123 });
      if (!result.success) {
        const error = result.error;
        errorHandler(error, req, res, next);
        
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: error.errors
          }
        });
      }
    });

    it('should handle Prisma unique constraint error', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '1.0.0',
        meta: { target: ['email'] }
      });
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: 'A record with this value already exists',
          details: { target: ['email'] }
        }
      });
    });

    it('should handle unknown errors', () => {
      const error = new Error('Unknown error');
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        }
      });
    });
  });

  describe('successResponse', () => {
    it('should return success response with data', () => {
      const data = { id: 1, name: 'Test' };
      successResponse(res, data, 'Success message');
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data,
        message: 'Success message'
      });
    });
  });

  describe('paginatedResponse', () => {
    it('should return paginated response', () => {
      const data = [{ id: 1 }, { id: 2 }];
      paginatedResponse(res, data, 10, 1, 5, 'Paginated data');
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data,
        pagination: {
          page: 1,
          limit: 5,
          total: 10,
          totalPages: 2
        },
        message: 'Paginated data'
      });
    });
  });
}); 