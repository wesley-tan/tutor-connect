import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { 
  authenticateSupabaseToken, 
  mockAuth, 
  requireRole,
  AuthenticatedRequest 
} from '../supabaseAuth';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
    admin: {
      createUser: jest.fn(),
      generateLink: jest.fn()
    }
  }
};

(createClient as jest.Mock).mockReturnValue(mockSupabaseClient);

describe('Supabase Auth Utilities', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      user: undefined
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticateSupabaseToken', () => {
    it('should authenticate valid token successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {
          firstName: 'Test',
          lastName: 'User',
          userType: 'student'
        }
      };

      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      await authenticateSupabaseToken(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual(mockUser);
    });

    it('should return 401 when no token provided', async () => {
      mockReq.headers = {};

      await authenticateSupabaseToken(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'No token provided'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token format is invalid', async () => {
      mockReq.headers = {
        authorization: 'InvalidFormat token'
      };

      await authenticateSupabaseToken(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token format'
      });
    });

    it('should return 401 when Supabase returns error', async () => {
      mockReq.headers = {
        authorization: 'Bearer invalid-token'
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      });

      await authenticateSupabaseToken(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
    });

    it('should return 401 when no user returned', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      await authenticateSupabaseToken(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
    });

    it('should handle Supabase client errors gracefully', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Network error'));

      await authenticateSupabaseToken(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication failed'
      });
    });

    it('should handle missing Supabase environment variables', async () => {
      const originalEnv = process.env.SUPABASE_URL;
      delete process.env.SUPABASE_URL;

      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      await authenticateSupabaseToken(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication service unavailable'
      });

      if (originalEnv) {
        process.env.SUPABASE_URL = originalEnv;
      }
    });

    it('should handle different token formats', async () => {
      const testCases = [
        'Bearer token123',
        'bearer token123',
        'BEARER token123',
        ' Token token123',
        'token123'
      ];

      for (const authHeader of testCases) {
        mockReq.headers = { authorization: authHeader };
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null
        });

        await authenticateSupabaseToken(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );

        expect(mockRes.status).toHaveBeenCalledWith(401);
        jest.clearAllMocks();
      }
    });
  });

  describe('mockAuth', () => {
    it('should set mock user for development', async () => {
      await mockAuth(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.id).toBe('mock-user-id');
      expect(mockReq.user?.email).toBe('mock@example.com');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set consistent mock user data', async () => {
      await mockAuth(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      const user = mockReq.user;
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('user_metadata');
      expect(user?.user_metadata).toHaveProperty('firstName');
      expect(user?.user_metadata).toHaveProperty('lastName');
      expect(user?.user_metadata).toHaveProperty('userType');
    });

    it('should handle multiple calls consistently', async () => {
      const calls = [];
      for (let i = 0; i < 5; i++) {
        await mockAuth(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );
        calls.push(mockReq.user);
        mockReq.user = undefined;
      }

      calls.forEach(user => {
        expect(user?.id).toBe('mock-user-id');
        expect(user?.email).toBe('mock@example.com');
      });
    });
  });

  describe('requireRole', () => {
    beforeEach(() => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {
          userType: 'student'
        }
      };
    });

    it('should allow access for matching role', async () => {
      const studentMiddleware = requireRole('student');
      
      await studentMiddleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should deny access for non-matching role', async () => {
      const tutorMiddleware = requireRole('tutor');
      
      await tutorMiddleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle multiple roles', async () => {
      const multiRoleMiddleware = requireRole(['student', 'tutor']);
      
      await multiRoleMiddleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access when user has no role', async () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {}
      };

      const studentMiddleware = requireRole('student');
      
      await studentMiddleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions'
      });
    });

    it('should handle missing user', async () => {
      mockReq.user = undefined;

      const studentMiddleware = requireRole('student');
      
      await studentMiddleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
    });

    it('should handle case-insensitive role matching', async () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {
          userType: 'STUDENT'
        }
      };

      const studentMiddleware = requireRole('student');
      
      await studentMiddleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed authorization headers', async () => {
      const malformedHeaders = [
        'Bearer',
        'Bearer ',
        ' Bearer token',
        'Bearer token extra',
        'Basic token',
        'Token token'
      ];

      for (const header of malformedHeaders) {
        mockReq.headers = { authorization: header };
        
        await authenticateSupabaseToken(
          mockReq as Request,
          mockRes as Response,
          mockNext
        );

        expect(mockRes.status).toHaveBeenCalledWith(401);
        jest.clearAllMocks();
      }
    });

    it('should handle very long tokens', async () => {
      const longToken = 'x'.repeat(10000);
      mockReq.headers = { authorization: `Bearer ${longToken}` };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      await authenticateSupabaseToken(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should handle concurrent authentication requests', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        mockReq.headers = { authorization: `Bearer token${i}` };
        promises.push(
          authenticateSupabaseToken(
            mockReq as Request,
            mockRes as Response,
            mockNext
          )
        );
      }

      await Promise.all(promises);
      
      // Should handle all requests without throwing
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledTimes(10);
    });

    it('should handle Supabase rate limiting', async () => {
      mockReq.headers = { authorization: 'Bearer valid-token' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Rate limit exceeded' }
      });

      await authenticateSupabaseToken(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Rate limit exceeded'
      });
    });

    it('should handle network timeouts', async () => {
      mockReq.headers = { authorization: 'Bearer valid-token' };

      mockSupabaseClient.auth.getUser.mockRejectedValue(
        new Error('Request timeout')
      );

      await authenticateSupabaseToken(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication failed'
      });
    });
  });

  describe('Type Safety and Integration', () => {
    it('should properly extend Request interface', () => {
      const request: AuthenticatedRequest = {
        headers: {},
        user: {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: {
            userType: 'student'
          }
        }
      } as AuthenticatedRequest;

      expect(request.user).toBeDefined();
      expect(request.user?.id).toBe('user-123');
    });

    it('should handle different user metadata structures', async () => {
      const userVariants = [
        { userType: 'student' },
        { userType: 'tutor' },
        { userType: 'admin' },
        { firstName: 'John', lastName: 'Doe' },
        {}
      ];

      for (const metadata of userVariants) {
        mockReq.user = {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: metadata
        };

        const studentMiddleware = requireRole('student');
        await studentMiddleware(
          mockReq as AuthenticatedRequest,
          mockRes as Response,
          mockNext
        );

        jest.clearAllMocks();
      }
    });

    it('should maintain request context through middleware chain', async () => {
      mockReq.headers = { authorization: 'Bearer valid-token' };
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: {
            id: 'user-123',
            email: 'test@example.com',
            user_metadata: { userType: 'student' }
          }
        },
        error: null
      });

      // First middleware
      await authenticateSupabaseToken(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.user).toBeDefined();

      // Second middleware
      const studentMiddleware = requireRole('student');
      await studentMiddleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });
}); 