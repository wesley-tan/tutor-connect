import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@tutorconnect/database';
import { logger } from './logger';
import { rateLimit } from 'express-rate-limit';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    supabaseId: string;
    userType: 'student' | 'tutor';
    firstName?: string;
    lastName?: string;
    roles: string[];
    permissions: string[];
  };
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Rate limiting configuration
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
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
async function logAuthEvent(eventType: string, userId: string | null, metadata: any) {
  try {
    await prisma.authEvent.create({
      data: {
        eventType,
        userId,
        metadata
      }
    });
  } catch (error) {
    logger.error('Failed to log auth event:', error);
  }
}

// Main authentication middleware
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      await logAuthEvent('auth.failed', null, {
        reason: 'NO_TOKEN',
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No token provided'
        }
      });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user: supabaseUser }, error: supabaseError } = await supabase.auth.getUser(token);

    if (supabaseError || !supabaseUser) {
      await logAuthEvent('auth.failed', null, {
        reason: 'INVALID_TOKEN',
        error: supabaseError?.message,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        }
      });
    }

    try {
      // Get or create user in our database
      let dbUser = await prisma.user.findUnique({
        where: { email: supabaseUser.email! },
        include: {
          tutorProfile: {
            select: {
              id: true,
              isVerified: true,
              subjects: true,
              hourlyRate: true,
              ratingAverage: true
            }
          },
          tuteeProfile: {
            select: {
              id: true,
              subjectNeeds: true
            }
          },
          roles: true,
          permissions: true
        }
    });

    if (!dbUser) {
        // Create new user with transaction
        const userType = supabaseUser.user_metadata?.userType || 'student';
        
        dbUser = await prisma.$transaction(async (prisma) => {
          // Create user
          const newUser = await prisma.user.create({
            data: {
              email: supabaseUser.email!,
              supabaseId: supabaseUser.id,
              firstName: supabaseUser.user_metadata?.firstName || '',
              lastName: supabaseUser.user_metadata?.lastName || '',
              userType: userType as 'student' | 'tutor',
              isVerified: false,
              lastLoginAt: new Date(),
              loginCount: 1,
              passwordHash: '', // Empty string for OAuth/magic link users
              roles: {
                create: [{
                  name: userType
                }]
              }
            },
            include: {
              roles: true,
              permissions: true
            }
          });

          // Create corresponding profile
          if (userType === 'student') {
            await prisma.tuteeProfile.create({
              data: {
                userId: newUser.id,
                preferredSessionLength: 60
              }
            });
          } else if (userType === 'tutor') {
            await prisma.tutorProfile.create({
              data: {
                userId: newUser.id,
                hourlyRate: 0,
                isVerified: false,
                ratingAverage: 0,
                totalReviews: 0,
                totalSessions: 0,
                teachingExperienceYears: 0
              }
            });
    }

          await logAuthEvent('user.create', newUser.id, {
            userType,
            ip: req.ip,
            userAgent: req.headers['user-agent']
          });

          return newUser;
        });
      } else {
        // Update login stats
        await prisma.user.update({
          where: { id: dbUser.id },
          data: {
            lastLoginAt: new Date(),
            loginCount: { increment: 1 }
          }
        });

        await logAuthEvent('user.login', dbUser.id, {
          ip: req.ip,
          userAgent: req.headers['user-agent']
        });
      }

      // Add user info to request
      (req as AuthenticatedRequest).user = {
      id: dbUser.id,
      email: dbUser.email,
      userType: dbUser.userType,
        supabaseId: supabaseUser.id,
        firstName: dbUser.firstName || undefined,
        lastName: dbUser.lastName || undefined,
        roles: dbUser.roles.map(role => role.name),
        permissions: dbUser.permissions.map(permission => permission.name)
      };

      await logAuthEvent('auth.success', dbUser.id, {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

    next();
    } catch (dbError: any) {
      logger.error('Database error in auth middleware:', dbError);
      
      await logAuthEvent('auth.error', null, {
        error: dbError.message,
        stack: dbError.stack,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Internal server error'
        }
      });
    }
  } catch (error: any) {
    logger.error('Authentication error:', error);
    
    await logAuthEvent('auth.error', null, {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed'
      }
    });
  }
};

// Role-based authorization middleware
export const requireRoles = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as any; // Assuming AuthenticatedRequest is removed or replaced
    const userRoles = authReq.user?.roles || [];

    if (!roles.some(role => userRoles.includes(role))) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource'
        }
      });
  }

    next();
  };
};

// Permission-based authorization middleware
export const requirePermissions = (permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as any; // Assuming AuthenticatedRequest is removed or replaced
    const userPermissions = authReq.user?.permissions || [];

    if (!permissions.some(permission => userPermissions.includes(permission))) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action'
        }
      });
    }

    next();
  };
};

// Development mock auth - only use if explicitly enabled
export const mockAuth = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Mock auth can only be used in development');
  }
  
  (req as any).user = { // Assuming AuthenticatedRequest is removed or replaced
    id: 'user-1',
    email: 'demo@example.com',
    userType: 'student',
    supabaseId: 'mock-supabase-id',
    firstName: 'Demo',
    lastName: 'User'
  };
  next();
}; 