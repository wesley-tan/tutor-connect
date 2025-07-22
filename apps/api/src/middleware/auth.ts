import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { prisma } from '@tutorconnect/database';

interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

// Rate limiting configuration
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.AUTH_RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) : 50,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/v1/auth/me'
});

// Auth event logging
async function logAuthEvent(eventType: string, userId: string | null, metadata: Record<string, unknown>) {
  try {
    await prisma.$queryRaw`
      INSERT INTO auth_events (id, event_type, user_id, metadata, created_at)
      VALUES (gen_random_uuid(), ${eventType}, ${userId}, ${metadata}::jsonb, NOW())
    `;
  } catch (error) {
    logger.error('Failed to log auth event:', error);
  }
}

// Role-based authorization middleware
export const requireRoles = (roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user as AuthUser;
      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const result = await prisma.$queryRaw<{ name: string }[]>`
        SELECT r.name 
        FROM roles r 
        JOIN "_RoleToUser" ru ON ru."A" = r.id 
        WHERE ru."B" = ${user.id}
      `;

      const userRoles = result.map(r => r.name);
      if (!roles.some(role => userRoles.includes(role))) {
        await logAuthEvent('auth.forbidden', user.id, {
          requiredRoles: roles,
          userRoles,
          path: req.path
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to access this resource'
          }
        });
      }

      return next();
    } catch (error) {
      logger.error('Error in requireRoles middleware:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      });
    }
  };
};

// Permission-based authorization middleware
export const requirePermissions = (permissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user as AuthUser;
      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const result = await prisma.$queryRaw<{ name: string }[]>`
        SELECT p.name 
        FROM permissions p 
        JOIN "_PermissionToUser" pu ON pu."A" = p.id 
        WHERE pu."B" = ${user.id}
      `;

      const userPermissions = result.map(p => p.name);
      if (!permissions.some(permission => userPermissions.includes(permission))) {
        await logAuthEvent('auth.forbidden', user.id, {
          requiredPermissions: permissions,
          userPermissions,
          path: req.path
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to perform this action'
          }
        });
      }

      return next();
    } catch (error) {
      logger.error('Error in requirePermissions middleware:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      });
    }
  };
};

// Request validation middleware
export const validateRequest = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors
          }
        });
      }
      return next(error);
    }
  };
};

// CSRF protection middleware
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['x-csrf-token'];
  const storedToken = req.cookies['csrf-token'];

  if (!token || !storedToken || token !== storedToken) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_ERROR',
        message: 'Invalid CSRF token'
      }
    });
  }

  return next();
}; 