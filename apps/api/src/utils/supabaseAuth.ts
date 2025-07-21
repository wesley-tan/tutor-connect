import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@tutorconnect/database';
import { AuthenticationError } from '../middleware/errorHandlers';
import { logger } from './logger';

// Initialize Supabase client for server-side operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Missing Supabase environment variables. Backend auth will not work properly.');
  // Don't throw error, just log warning
}

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    userType: string;
    supabaseId: string;
  };
}

// Verify Supabase access token
export const verifySupabaseToken = async (token: string) => {
  try {
    const { data: { user }, error } = await supabase!.auth.getUser(token);
    
    if (error || !user) {
      throw new AuthenticationError('Invalid access token');
    }

    return user;
  } catch (error) {
    logger.error('Supabase token verification failed', { error: error.message });
    throw new AuthenticationError('Invalid access token');
  }
};

// Middleware to authenticate Supabase tokens
export const authenticateSupabaseToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw new AuthenticationError('Access token required');
    }

    // Verify the Supabase token
    const supabaseUser = await verifySupabaseToken(token);
    
    // Find or create user in our database
    let user = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
      select: { id: true, email: true, userType: true, isActive: true, supabaseId: true }
    });

    // If user doesn't exist in our database, create them
    if (!user) {
      const userType = supabaseUser.user_metadata?.userType || 'student';
      const firstName = supabaseUser.user_metadata?.firstName || '';
      const lastName = supabaseUser.user_metadata?.lastName || '';
      
      user = await prisma.user.create({
        data: {
          supabaseId: supabaseUser.id,
          email: supabaseUser.email!,
          firstName,
          lastName,
          userType,
          isActive: true,
          authProvider: 'supabase'
        },
        select: { id: true, email: true, userType: true, isActive: true, supabaseId: true }
      });
    }

    if (!user.isActive) {
      throw new AuthenticationError('User account is inactive');
    }

    // Attach user to request
    (req as AuthenticatedRequest).user = {
      id: user.id,
      email: user.email,
      userType: user.userType,
      supabaseId: user.supabaseId
    };

    next();
  } catch (error) {
    logger.error('Supabase authentication failed', { error: error.message, ip: req.ip });
    next(error);
  }
};

// Authorization middleware
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!roles.includes(user.userType)) {
      throw new AuthenticationError(`Access denied. Required roles: ${roles.join(', ')}`);
    }

    next();
  };
};

// Optional authentication (doesn't throw if no token)
export const optionalSupabaseAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const supabaseUser = await verifySupabaseToken(token);
      
      let user = await prisma.user.findUnique({
        where: { supabaseId: supabaseUser.id },
        select: { id: true, email: true, userType: true, isActive: true, supabaseId: true }
      });

      if (user && user.isActive) {
        (req as AuthenticatedRequest).user = {
          id: user.id,
          email: user.email,
          userType: user.userType,
          supabaseId: user.supabaseId
        };
      }
    }
    next();
  } catch (error) {
    // Don't throw, just continue without auth
    next();
  }
}; 