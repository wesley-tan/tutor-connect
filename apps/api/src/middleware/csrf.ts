import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { logger } from '../utils/logger';
import { AuditService } from '../services/auditService';
import type { AuthenticatedRequest } from '../utils/supabaseAuth';

const CSRF_HEADER = 'X-CSRF-Token';
const CSRF_COOKIE = 'csrf_token';
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// Generate a random CSRF token
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

// Validate that the token in the header matches the token in the cookie
function validateToken(headerToken?: string, cookieToken?: string): boolean {
  if (!headerToken || !cookieToken) {
    return false;
  }
  return headerToken === cookieToken;
}

// CSRF protection middleware
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF check for safe methods
  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }

  try {
    // For the first request, set up CSRF token
    if (!req.cookies[CSRF_COOKIE]) {
      const token = generateToken();
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      res.header(CSRF_HEADER, token);
      return next();
    }

    // For subsequent requests, validate the token
    const headerToken = req.headers[CSRF_HEADER.toLowerCase()];
    const cookieToken = req.cookies[CSRF_COOKIE];

    if (!validateToken(headerToken as string, cookieToken)) {
      // Log CSRF attempt
      AuditService.log(
        req as AuthenticatedRequest,
        'auth.failed_attempt',
        'auth',
        undefined,
        undefined,
        undefined,
        {
          errorCode: 'CSRF_VALIDATION_FAILED',
          errorMessage: 'CSRF token validation failed',
          path: req.path,
          method: req.method
        }
      );

      logger.warn('CSRF validation failed', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_VALIDATION_FAILED',
          message: 'Invalid CSRF token'
        }
      });
    }

    // Generate a new token for the next request
    const newToken = generateToken();
    res.cookie(CSRF_COOKIE, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    res.header(CSRF_HEADER, newToken);

    next();
  } catch (error) {
    logger.error('CSRF middleware error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'CSRF_ERROR',
        message: 'CSRF protection error'
      }
    });
  }
}

// Middleware to set initial CSRF token
export function initializeCsrf(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.cookies[CSRF_COOKIE]) {
      const token = generateToken();
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      res.header(CSRF_HEADER, token);
    }
    next();
  } catch (error) {
    logger.error('CSRF initialization error:', error);
    next(error);
  }
} 