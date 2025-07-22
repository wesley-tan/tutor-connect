import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@tutorconnect/database';
import { AuthenticationError } from '../middleware/errorHandlers';
import { logger } from './logger';
import { AuditService } from '../services/auditService';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    userType: string;
    supabaseId: string;
    firstName?: string;
    lastName?: string;
  };
}

// Verify JWT and attach user to request
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      await AuditService.log(
        req as AuthenticatedRequest,
        'auth.failed_attempt',
        'auth',
        undefined,
        undefined,
        undefined,
        { errorCode: 'NO_TOKEN', errorMessage: 'No token provided' }
      );
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No token provided'
        }
      });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: supabaseError } = await supabase.auth.getUser(token);

    if (supabaseError || !user) {
      await AuditService.log(
        req as AuthenticatedRequest,
        'auth.failed_attempt',
        'auth',
        undefined,
        undefined,
        undefined,
        { 
          errorCode: 'INVALID_TOKEN',
          errorMessage: supabaseError?.message || 'Invalid token',
          supabaseError 
        }
      );
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token'
        }
      });
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      include: {
        tutorProfile: {
          select: {
            id: true,
            isVerified: true,
            ratingAverage: true
          }
        },
        tuteeProfile: {
          select: {
            id: true
          }
        }
      }
    });

    if (!dbUser) {
      // Create user if they don't exist
      try {
        const newUser = await prisma.user.create({
          data: {
            email: user.email!,
            supabaseId: user.id,
            firstName: user.user_metadata?.firstName,
            lastName: user.user_metadata?.lastName,
            userType: user.user_metadata?.userType || 'student',
            isVerified: false,
            lastLoginAt: new Date(),
            loginCount: 1
          }
        });

        // Create profile based on user type
        if (newUser.userType === 'student') {
          await prisma.tuteeProfile.create({
            data: {
              userId: newUser.id
            }
          });
        } else if (newUser.userType === 'tutor') {
          await prisma.tutorProfile.create({
            data: {
              userId: newUser.id,
              hourlyRate: 0,
              isVerified: false,
              ratingAverage: 0,
              totalReviews: 0
            }
          });
        }

        // Attach new user to request
        (req as AuthenticatedRequest).user = {
          id: newUser.id,
          email: newUser.email,
          userType: newUser.userType,
          supabaseId: user.id,
          firstName: newUser.firstName,
          lastName: newUser.lastName
        };

        // Log user creation
        await AuditService.log(
          req as AuthenticatedRequest,
          'user.create',
          'user',
          newUser.id,
          undefined,
          { email: newUser.email, userType: newUser.userType }
        );

        next();
      } catch (error) {
        logger.error('Error creating new user:', error);
        await AuditService.log(
          req as AuthenticatedRequest,
          'user.create',
          'user',
          undefined,
          undefined,
          undefined,
          { error }
        );
        
        return res.status(500).json({
          success: false,
          error: {
            code: 'USER_CREATION_FAILED',
            message: 'Failed to create user'
          }
        });
      }
    } else {
      // Update login stats
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          lastLoginAt: new Date(),
          loginCount: { increment: 1 }
        }
      });

      // Attach existing user to request
      (req as AuthenticatedRequest).user = {
        id: dbUser.id,
        email: dbUser.email,
        userType: dbUser.userType,
        supabaseId: user.id,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName
      };

      // Log successful authentication
      await AuditService.log(
        req as AuthenticatedRequest,
        'auth.login',
        'auth',
        dbUser.id
      );

      next();
    }
  } catch (error) {
    logger.error('Authentication error:', error);
    await AuditService.log(
      req as AuthenticatedRequest,
      'auth.failed_attempt',
      'auth',
      undefined,
      undefined,
      undefined,
      { error }
    );
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed'
      }
    });
  }
};

// Development mock auth - only use if explicitly enabled
export const mockAuth = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Mock auth can only be used in development');
  }
  
  (req as AuthenticatedRequest).user = {
    id: 'user-1',
    email: 'demo@example.com',
    userType: 'student',
    supabaseId: 'mock-supabase-id',
    firstName: 'Demo',
    lastName: 'User'
  };
  next();
}; 