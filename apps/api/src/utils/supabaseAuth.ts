import { createClient } from '@supabase/supabase-js';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '@tutorconnect/database';
import { logger } from './logger';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

let supabase: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

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

export const authenticateSupabaseToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!supabase) {
      logger.warn('Supabase not configured, skipping authentication');
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No valid authorization header provided'
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
      return;
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { email: supabaseUser.email! },
      select: {
        id: true,
        email: true,
        userType: true,
        isActive: true
      }
    });

    if (!dbUser || !dbUser.isActive) {
      res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
      return;
    }

    // Attach user to request
    (req as AuthenticatedRequest).user = {
      id: dbUser.id,
      email: dbUser.email,
      userType: dbUser.userType,
      supabaseId: supabaseUser.id
    };

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

export const requireRole = (requiredRole: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (user.userType !== requiredRole) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${requiredRole}`
      });
      return;
    }

    next();
  };
};

// Mock authentication middleware for development
export const mockAuth = (req: Request, res: Response, next: NextFunction) => {
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