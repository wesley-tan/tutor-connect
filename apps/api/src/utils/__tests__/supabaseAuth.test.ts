import { Request, Response, NextFunction } from 'express';
import { authenticateToken, requireRoles, requirePermissions } from '../supabaseAuth';
import { supabase } from '../supabase';
import { prisma } from '@tutorconnect/database';

// Mock Supabase
jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn()
    }
  }
}));

// Mock Prisma
jest.mock('@tutorconnect/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    tuteeProfile: {
      create: jest.fn()
    },
    tutorProfile: {
      create: jest.fn()
    }
  }
}));

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      ip: '127.0.0.1',
      get: jest.fn()
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should return 401 if no token provided', async () => {
      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No token provided'
        }
      });
    });

    it('should return 401 if invalid token', async () => {
      mockReq.headers = { authorization: 'Bearer invalid_token' };
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      });

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token'
        }
      });
    });

    it('should create new user if not exists', async () => {
      const mockUser = {
        id: 'test-id',
        email: 'test@example.com',
        user_metadata: {
          firstName: 'Test',
          lastName: 'User',
          userType: 'student'
        }
      };

      mockReq.headers = { authorization: 'Bearer valid_token' };
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'db-id',
        email: mockUser.email,
        firstName: mockUser.user_metadata.firstName,
        lastName: mockUser.user_metadata.lastName,
        userType: mockUser.user_metadata.userType,
        roles: [{ name: 'student' }],
        permissions: []
      });

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.tuteeProfile.create).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should update existing user login stats', async () => {
      const mockUser = {
        id: 'test-id',
        email: 'test@example.com',
        user_metadata: {
          firstName: 'Test',
          lastName: 'User',
          userType: 'student'
        }
      };

      const mockDbUser = {
        id: 'db-id',
        email: mockUser.email,
        firstName: mockUser.user_metadata.firstName,
        lastName: mockUser.user_metadata.lastName,
        userType: mockUser.user_metadata.userType,
        roles: [{ name: 'student' }],
        permissions: []
      };

      mockReq.headers = { authorization: 'Bearer valid_token' };
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockDbUser);

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockDbUser.id },
        data: {
          lastLoginAt: expect.any(Date),
          loginCount: { increment: 1 }
        }
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireRoles', () => {
    it('should allow access if user has required role', () => {
      const middleware = requireRoles(['admin']);
      mockReq.user = {
        id: 'test-id',
        email: 'test@example.com',
        userType: 'admin',
        supabaseId: 'test-supabase-id',
        roles: ['admin']
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access if user lacks required role', () => {
      const middleware = requireRoles(['admin']);
      mockReq.user = {
        id: 'test-id',
        email: 'test@example.com',
        userType: 'student',
        supabaseId: 'test-supabase-id',
        roles: ['student']
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource'
        }
      });
    });
  });

  describe('requirePermissions', () => {
    it('should allow access if user has required permission', () => {
      const middleware = requirePermissions(['create_session']);
      mockReq.user = {
        id: 'test-id',
        email: 'test@example.com',
        userType: 'tutor',
        supabaseId: 'test-supabase-id',
        permissions: ['create_session']
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access if user lacks required permission', () => {
      const middleware = requirePermissions(['create_session']);
      mockReq.user = {
        id: 'test-id',
        email: 'test@example.com',
        userType: 'student',
        supabaseId: 'test-supabase-id',
        permissions: []
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action'
        }
      });
    });
  });
}); 