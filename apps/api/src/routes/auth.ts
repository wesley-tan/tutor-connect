import express, { Request, Response } from 'express';
import { prisma } from '@tutorconnect/database';
import { asyncHandler, successResponse, ValidationError, ConflictError } from '../middleware/errorHandlers';
import { 
  hashPassword, 
  comparePassword, 
  generateTokens, 
  verifyRefreshToken,
  authenticateToken,
  AuthenticatedRequest 
} from '../utils/auth';
import { 
  RegisterSchema, 
  LoginSchema, 
  RefreshTokenSchema,
  UpdateProfileSchema,
  ChangePasswordSchema
} from '../schemas/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Register new user
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  // Validate input
  const validatedData = RegisterSchema.parse(req.body);
  
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: validatedData.email }
  });
  
  if (existingUser) {
    throw new ConflictError('User with this email already exists');
  }
  
  // Hash password
  const passwordHash = await hashPassword(validatedData.password);
  
  // Create user
  const user = await prisma.user.create({
    data: {
      email: validatedData.email,
      passwordHash,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      userType: validatedData.userType,
      phone: validatedData.phone,
      timezone: validatedData.timezone || 'UTC'
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      userType: true,
      phone: true,
      timezone: true,
      isVerified: true,
      createdAt: true
    }
  });
  
  // Generate tokens
  const tokens = generateTokens({
    id: user.id,
    email: user.email,
    userType: user.userType
  });
  
  logger.info('User registered successfully', { 
    userId: user.id, 
    email: user.email, 
    userType: user.userType 
  });
  
  successResponse(res, {
    user,
    tokens
  }, 'Registration successful', 201);
}));

// Login user
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  // Validate input
  const { email, password } = LoginSchema.parse(req.body);
  
  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      firstName: true,
      lastName: true,
      userType: true,
      phone: true,
      timezone: true,
      isVerified: true,
      isActive: true,
      createdAt: true
    }
  });
  
  if (!user) {
    throw new ValidationError('Invalid email or password');
  }
  
  if (!user.isActive) {
    throw new ValidationError('Account is deactivated');
  }
  
  // Verify password
  const isValidPassword = await comparePassword(password, user.passwordHash);
  if (!isValidPassword) {
    throw new ValidationError('Invalid email or password');
  }
  
  // Generate tokens
  const tokens = generateTokens({
    id: user.id,
    email: user.email,
    userType: user.userType
  });
  
  // Remove password hash from response
  const { passwordHash, ...userResponse } = user;
  
  logger.info('User logged in successfully', { 
    userId: user.id, 
    email: user.email,
    ip: req.ip 
  });
  
  successResponse(res, {
    user: userResponse,
    tokens
  }, 'Login successful');
}));

// Refresh access token
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = RefreshTokenSchema.parse(req.body);
  
  // Verify refresh token
  const payload = verifyRefreshToken(refreshToken);
  
  // Verify user still exists and is active
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, userType: true, isActive: true }
  });
  
  if (!user || !user.isActive) {
    throw new ValidationError('Invalid refresh token');
  }
  
  // Generate new tokens
  const tokens = generateTokens({
    id: user.id,
    email: user.email,
    userType: user.userType
  });
  
  successResponse(res, { tokens }, 'Token refreshed successfully');
}));

// Get current user profile
router.get('/profile', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { user: authUser } = req as AuthenticatedRequest;
  
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      userType: true,
      phone: true,
      profileImageUrl: true,
      timezone: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true
    }
  });
  
  if (!user) {
    throw new ValidationError('User not found');
  }
  
  successResponse(res, { user }, 'Profile retrieved successfully');
}));

// Update user profile
router.put('/profile', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { user: authUser } = req as AuthenticatedRequest;
  const validatedData = UpdateProfileSchema.parse(req.body);
  
  const updatedUser = await prisma.user.update({
    where: { id: authUser.id },
    data: validatedData,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      userType: true,
      phone: true,
      profileImageUrl: true,
      timezone: true,
      isVerified: true,
      updatedAt: true
    }
  });
  
  logger.info('User profile updated', { userId: authUser.id });
  
  successResponse(res, { user: updatedUser }, 'Profile updated successfully');
}));

// Change password
router.put('/password', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { user: authUser } = req as AuthenticatedRequest;
  const { currentPassword, newPassword } = ChangePasswordSchema.parse(req.body);
  
  // Get current password hash
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { passwordHash: true }
  });
  
  if (!user) {
    throw new ValidationError('User not found');
  }
  
  // Verify current password
  const isValidPassword = await comparePassword(currentPassword, user.passwordHash);
  if (!isValidPassword) {
    throw new ValidationError('Current password is incorrect');
  }
  
  // Hash new password
  const newPasswordHash = await hashPassword(newPassword);
  
  // Update password
  await prisma.user.update({
    where: { id: authUser.id },
    data: { passwordHash: newPasswordHash }
  });
  
  logger.info('User password changed', { userId: authUser.id });
  
  successResponse(res, null, 'Password changed successfully');
}));

// Logout (for future session tracking)
router.post('/logout', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { user: authUser } = req as AuthenticatedRequest;
  
  // For now, just log the logout
  // In the future, we could invalidate tokens in Redis
  logger.info('User logged out', { userId: authUser.id });
  
  successResponse(res, null, 'Logout successful');
}));

export default router; 