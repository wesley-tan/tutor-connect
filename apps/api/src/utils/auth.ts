import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '@tutorconnect/database';
import { AuthenticationError, AuthorizationError } from '../middleware/errorHandlers';
import { logger } from './logger';

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

export interface TokenPayload {
  userId: string;
  email: string;
  userType: string;
  type: 'access' | 'refresh';
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    userType: string;
  };
}

// Password utilities
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// JWT utilities
export const generateTokens = (user: { id: string; email: string; userType: string }) => {
  const accessTokenPayload: TokenPayload = {
    userId: user.id,
    email: user.email,
    userType: user.userType,
    type: 'access'
  };

  const refreshTokenPayload: TokenPayload = {
    userId: user.id,
    email: user.email,
    userType: user.userType,
    type: 'refresh'
  };

  const accessToken = jwt.sign(accessTokenPayload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'tutorconnect-api',
    audience: 'tutorconnect-app'
  } as jwt.SignOptions);

  const refreshToken = jwt.sign(refreshTokenPayload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    issuer: 'tutorconnect-api',
    audience: 'tutorconnect-app'
  } as jwt.SignOptions);

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: 'tutorconnect-api',
      audience: 'tutorconnect-app'
    }) as TokenPayload;
    
    if (payload.type !== 'access') {
      throw new Error('Invalid token type');
    }
    
    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Access token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid access token');
    }
    throw new AuthenticationError('Token verification failed');
  }
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'tutorconnect-api',
      audience: 'tutorconnect-app'
    }) as TokenPayload;
    
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Refresh token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid refresh token');
    }
    throw new AuthenticationError('Token verification failed');
  }
};

// Middleware
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw new AuthenticationError('Access token required');
    }

    const payload = verifyAccessToken(token);
    
    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, userType: true, isActive: true }
    });

    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }

    // Attach user to request
    (req as AuthenticatedRequest).user = {
      id: user.id,
      email: user.email,
      userType: user.userType
    };

    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Authentication failed', { error: errorMessage, ip: req.ip });
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
      throw new AuthorizationError(`Access denied. Required roles: ${roles.join(', ')}`);
    }

    next();
  };
};

// Optional authentication (doesn't throw if no token)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, userType: true, isActive: true }
      });

      if (user && user.isActive) {
        (req as AuthenticatedRequest).user = {
          id: user.id,
          email: user.email,
          userType: user.userType
        };
      }
    }
    next();
  } catch (error) {
    // Don't throw, just continue without auth
    next();
  }
}; 