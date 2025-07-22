import { PrismaClient, User, UserType } from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import {
  authenticateSupabaseToken,
  mockAuth,
  requireRole,
  hashPassword,
  comparePassword,
  generateTokens,
  verifyToken
} from '../utils/auth';
import { logger } from '../utils/logger';

jest.mock('@supabase/supabase-js');
jest.mock('bcryptjs');
jest.mock('../utils/logger');

const mockPrisma = mockDeep<PrismaClient>();
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
    api: {
      getUser: jest.fn()
    }
  }
};

(createClient as jest.Mock).mockReturnValue(mockSupabase);

describe('Auth Utils', () => {
  const mockUserId = 'user-1';
  const mockUser: Partial<User> = {
    id: mockUserId,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    userType: UserType.STUDENT,
    isActive: true,
    isVerified: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateSupabaseToken', () => {
    const mockReq = {
      headers: {
        authorization: 'Bearer valid-token'
      },
      get: jest.fn()
    };
    const mockRes = {};
    const mockNext = jest.fn();

    it('should authenticate valid token and attach user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId, email: 'test@example.com' } },
        error: null
      });

      await authenticateSupabaseToken(mockReq as any, mockRes as any, mockNext);

      expect(mockReq).toHaveProperty('user');
      expect(mockReq.user).toHaveProperty('supabaseId', mockUserId);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing authorization header', async () => {
      const reqWithoutAuth = { headers: {}, get: jest.fn() };

      await authenticateSupabaseToken(reqWithoutAuth as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle invalid token format', async () => {
      const reqWithInvalidToken = {
        headers: { authorization: 'InvalidFormat' },
        get: jest.fn()
      };

      await authenticateSupabaseToken(reqWithInvalidToken as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle Supabase auth error', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Invalid token')
      });

      await authenticateSupabaseToken(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('mockAuth', () => {
    const mockReq = {};
    const mockRes = {};
    const mockNext = jest.fn();

    it('should attach mock user data', () => {
      mockAuth(mockReq as any, mockRes as any, mockNext);

      expect(mockReq).toHaveProperty('user');
      expect(mockReq.user).toHaveProperty('supabaseId');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    const mockReq = {
      user: {
        ...mockUser,
        userType: UserType.STUDENT
      }
    };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const mockNext = jest.fn();

    it('should allow access for matching role', () => {
      const middleware = requireRole([UserType.STUDENT]);
      middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should deny access for non-matching role', () => {
      const middleware = requireRole([UserType.TUTOR]);
      middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: expect.any(String)
      }));
    });

    it('should handle missing user', () => {
      const reqWithoutUser = {};
      const middleware = requireRole([UserType.STUDENT]);
      middleware(reqWithoutUser as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('hashPassword and comparePassword', () => {
    const password = 'testPassword123';
    const hashedPassword = 'hashedTestPassword123';

    it('should hash password successfully', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const result = await hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(bcrypt.hash).toHaveBeenCalledWith(password, expect.any(Number));
    });

    it('should compare password successfully', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await comparePassword(password, hashedPassword);

      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
    });

    it('should handle invalid password comparison', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await comparePassword('wrongPassword', hashedPassword);

      expect(result).toBe(false);
    });
  });

  describe('generateTokens and verifyToken', () => {
    const mockPayload = {
      userId: mockUserId,
      email: 'test@example.com',
      role: UserType.STUDENT
    };

    it('should generate access and refresh tokens', () => {
      const { accessToken, refreshToken } = generateTokens(mockPayload);

      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();
      expect(typeof accessToken).toBe('string');
      expect(typeof refreshToken).toBe('string');
    });

    it('should verify valid token', () => {
      const { accessToken } = generateTokens(mockPayload);
      const result = verifyToken(accessToken);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('userId', mockUserId);
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyToken('invalid-token')).toThrow();
    });

    it('should throw error for expired token', () => {
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      expect(() => verifyToken('expired-token')).toThrow('Token expired');
    });
  });
}); 