import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

// Custom error classes
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// Success response helper
export const successResponse = (
  res: Response,
  data: any,
  message: string = 'Success',
  status: number = 200
) => {
  return res.status(status).json({
    success: true,
    message,
    ...data
  });
};

// Async handler wrapper
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Global error handler
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Error:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Handle specific error types
  if (err instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      message: err.message,
      error: 'Validation Error'
    });
  }

  if (err instanceof NotFoundError) {
    return res.status(404).json({
      success: false,
      message: err.message,
      error: 'Not Found'
    });
  }

  if (err instanceof AuthenticationError) {
    return res.status(401).json({
      success: false,
      message: err.message,
      error: 'Authentication Error'
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
    });
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': // Unique constraint violation
        return res.status(409).json({
          success: false,
          message: 'A record with this value already exists',
          error: 'Duplicate Entry'
        });
      case 'P2025': // Record not found
        return res.status(404).json({
          success: false,
          message: 'Record not found',
          error: 'Not Found'
        });
      default:
        return res.status(500).json({
          success: false,
          message: 'Database operation failed',
          error: 'Database Error'
        });
    }
  }

  // Handle unknown errors
  return res.status(500).json({
    success: false,
    message: 'An unexpected error occurred',
    error: 'Internal Server Error'
  });
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.method} ${req.url} not found`);
  next(error);
};

// Pagination response helper
export const paginatedResponse = (
  res: Response,
  data: any[],
  total: number,
  page: number,
  limit: number,
  message: string = 'Success'
) => {
  const totalPages = Math.ceil(total / limit);
  
  res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    },
    timestamp: new Date().toISOString()
  });
}; 