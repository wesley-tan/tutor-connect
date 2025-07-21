import { PrismaClient, User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ModernAuthService {
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaClient,
    private jwtSecret: string,
    private jwtRefreshSecret: string
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  // Google OAuth Authentication
  async authenticateWithGoogle(idToken: string): Promise<AuthTokens> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID!
      });

      const payload = ticket.getPayload()!;
      
      if (!payload.email) {
        throw new AuthError('Email not provided by Google', 'INVALID_GOOGLE_TOKEN');
      }

      // Find or create user
      let user = await this.prisma.user.findUnique({
        where: { email: payload.email }
      });

      if (!user) {
        // Create new user with Google data
        user = await this.prisma.user.create({
          data: {
            email: payload.email,
            firstName: payload.given_name || 'Unknown',
            lastName: payload.family_name || 'User',
            profileImageUrl: payload.picture,
            authProvider: 'google',
            googleId: payload.sub,
            isVerified: true,
            userType: 'student' // Default, can be updated later
          }
        });
      } else {
        // Update existing user with Google info if needed
        if (!user.googleId) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: {
              googleId: payload.sub,
              authProvider: 'google',
              profileImageUrl: payload.picture,
              isVerified: true
            }
          });
        }
      }

      return this.generateTokens(user);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Google authentication failed', 'GOOGLE_AUTH_ERROR');
    }
  }

  // Register new user (without password)
  async registerUser(data: {
    email: string;
    firstName: string;
    lastName: string;
    userType: 'student' | 'tutor';
    phone?: string | undefined;
  }): Promise<AuthTokens> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      throw new AuthError('User already exists', 'USER_EXISTS');
    }

    // Create new user
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        userType: data.userType,
        phone: data.phone,
        authProvider: 'supabase',
        isVerified: false
      }
    });

    return this.generateTokens(user);
  }

  // Refresh token
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret) as any;
      
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        throw new AuthError('User not found', 'USER_NOT_FOUND');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new AuthError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }
  }

  // Generate JWT tokens
  private generateTokens(user: User): AuthTokens {
    const accessToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        userType: user.userType 
      },
      this.jwtSecret,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { 
        userId: user.id, 
        sessionId: crypto.randomUUID() 
      },
      this.jwtRefreshSecret,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken, user };
  }

  // Verify access token
  async verifyToken(token: string): Promise<User> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        throw new AuthError('User not found', 'USER_NOT_FOUND');
      }

      return user;
    } catch (error) {
      throw new AuthError('Invalid token', 'INVALID_TOKEN');
    }
  }

  // Logout (revoke refresh token)
  async logout(userId: string): Promise<void> {
    // In a more sophisticated implementation, you might want to store
    // revoked tokens in Redis or database for immediate invalidation
    // For now, we'll rely on the short expiration time of access tokens
  }

  // Get user by Supabase ID
  async getUserBySupabaseId(supabaseId: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { supabaseId }
    });
  }

  // Create or update user from Supabase
  async syncUserFromSupabase(supabaseUser: any): Promise<User> {
    const { id: supabaseId, email, user_metadata } = supabaseUser;
    
    let user = await this.prisma.user.findUnique({
      where: { supabaseId }
    });

    if (!user) {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          supabaseId,
          email: email!,
          firstName: user_metadata?.firstName || 'Unknown',
          lastName: user_metadata?.lastName || 'User',
          userType: user_metadata?.userType || 'student',
          authProvider: 'supabase',
          isVerified: true
        }
      });
    } else {
      // Update existing user
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: email!,
          firstName: user_metadata?.firstName || user.firstName,
          lastName: user_metadata?.lastName || user.lastName,
          userType: user_metadata?.userType || user.userType,
          isVerified: true
        }
      });
    }

    return user;
  }
} 