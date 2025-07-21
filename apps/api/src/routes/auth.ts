import express, { Request, Response } from 'express';
import { prisma } from '@tutorconnect/database';
import { asyncHandler, successResponse, ValidationError, ConflictError } from '../middleware/errorHandlers';
import { ModernAuthService, AuthError } from '../services/authService';
import { logger } from '../utils/logger';
import { z } from 'zod';

const authService = new ModernAuthService(
  prisma,
  process.env.JWT_SECRET!,
  process.env.JWT_REFRESH_SECRET!
);

const router = express.Router();

// Register new user (without password)
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    email: z.string().email(),
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
    userType: z.enum(['student', 'tutor']),
    phone: z.string().optional()
  });

  const validatedData = schema.parse(req.body);
  
  try {
    const result = await authService.registerUser({
      email: validatedData.email,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      userType: validatedData.userType,
      phone: validatedData.phone
    });
    
    logger.info('User registered successfully', { 
      userId: result.user.id, 
      email: result.user.email, 
      userType: result.user.userType 
    });
    
    successResponse(res, {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        userType: result.user.userType,
        phone: result.user.phone,
        isVerified: result.user.isVerified,
        createdAt: result.user.createdAt
      },
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      }
    }, 'Registration successful', 201);
  } catch (error) {
    if (error instanceof AuthError && error.code === 'USER_EXISTS') {
      throw new ConflictError('User with this email already exists');
    }
    throw error;
  }
}));

// Google OAuth Authentication
router.post('/google', asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    idToken: z.string()
  });

  const { idToken } = schema.parse(req.body);
  
  try {
    const result = await authService.authenticateWithGoogle(idToken);
    
    logger.info('Google authentication successful', { 
      userId: result.user.id, 
      email: result.user.email 
    });
    
    successResponse(res, {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        userType: result.user.userType,
        phone: result.user.phone,
        profileImageUrl: result.user.profileImageUrl,
        isVerified: result.user.isVerified,
        createdAt: result.user.createdAt
      },
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      }
    }, 'Google authentication successful');
  } catch (error) {
    if (error instanceof AuthError) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
}));

// Sync user from Supabase
router.post('/sync-supabase', asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    supabaseUser: z.object({
      id: z.string(),
      email: z.string().email(),
      user_metadata: z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        userType: z.enum(['student', 'tutor']).optional()
      }).optional()
    })
  });

  const { supabaseUser } = schema.parse(req.body);
  
  try {
    const user = await authService.syncUserFromSupabase(supabaseUser);
    
    logger.info('User synced from Supabase', { 
      userId: user.id, 
      email: user.email 
    });
    
    successResponse(res, {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        phone: user.phone,
        profileImageUrl: user.profileImageUrl,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      }
    }, 'User synced successfully');
  } catch (error) {
    if (error instanceof AuthError) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
}));

// Refresh Token
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({
    refreshToken: z.string()
  });

  const { refreshToken } = schema.parse(req.body);
  
  try {
    const result = await authService.refreshToken(refreshToken);
    
    successResponse(res, {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        userType: result.user.userType,
        phone: result.user.phone,
        isVerified: result.user.isVerified,
        createdAt: result.user.createdAt
      },
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      }
    }, 'Token refreshed successfully');
  } catch (error) {
    if (error instanceof AuthError) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
}));

// Get current user profile
router.get('/profile', asyncHandler(async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new ValidationError('No token provided');
  }
  
  try {
    const user = await authService.verifyToken(token);
    
    successResponse(res, {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        phone: user.phone,
        profileImageUrl: user.profileImageUrl,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      }
    }, 'Profile retrieved successfully');
  } catch (error) {
    if (error instanceof AuthError) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
}));

// Update user profile
router.put('/profile', asyncHandler(async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new ValidationError('No token provided');
  }
  
  const schema = z.object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    phone: z.string().optional(),
    userType: z.enum(['student', 'tutor']).optional()
  });

  const validatedData = schema.parse(req.body);
  
  try {
    const user = await authService.verifyToken(token);
    
    // Filter out undefined values
    const updateData = Object.fromEntries(
      Object.entries(validatedData).filter(([_, value]) => value !== undefined)
    );
    
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userType: true,
        phone: true,
        profileImageUrl: true,
        isVerified: true,
        createdAt: true
      }
    });
    
    logger.info('Profile updated', { userId: user.id });
    
    successResponse(res, {
      user: updatedUser
    }, 'Profile updated successfully');
  } catch (error) {
    if (error instanceof AuthError) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
}));

// Logout
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new ValidationError('No token provided');
  }
  
  try {
    const user = await authService.verifyToken(token);
    await authService.logout(user.id);
    
    logger.info('User logged out', { userId: user.id });
    
    successResponse(res, {}, 'Logged out successfully');
  } catch (error) {
    if (error instanceof AuthError) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
}));

export default router; 