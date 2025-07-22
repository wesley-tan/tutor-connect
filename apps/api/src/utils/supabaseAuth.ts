import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@tutorconnect/database';
import { AuthenticationError } from '../middleware/errorHandlers';
import { logger } from './logger';

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
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new AuthenticationError('Invalid token');
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! }
    });

    if (!dbUser) {
      throw new AuthenticationError('User not found');
    }

    // Attach user to request
    (req as AuthenticatedRequest).user = {
      id: dbUser.id,
      email: dbUser.email,
      userType: dbUser.userType,
      supabaseId: user.id,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName
    };

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    next(error);
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