import { Request, Response } from 'express';
import { authenticateSupabaseToken } from '../utils/supabaseAuth';
import { mockSupabase } from './setup';

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      headers: {},
      get: jest.fn()
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if no token is provided', async () => {
    await authenticateSupabaseToken(
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        message: 'Access token required',
        code: 'AUTHENTICATION_ERROR'
      }
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 if token is invalid', async () => {
    mockReq.headers = {
      authorization: 'Bearer invalid-token'
    };

    mockSupabase.auth.getUser.mockRejectedValueOnce(new Error('Invalid token'));

    await authenticateSupabaseToken(
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        message: 'Authentication failed',
        code: 'AUTHENTICATION_ERROR'
      }
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next() with valid token', async () => {
    mockReq.headers = {
      authorization: 'Bearer valid-token'
    };

    const mockUser = {
      id: 'test-user-1',
      email: 'test1@example.com',
      user_metadata: {
        userType: 'student',
        firstName: 'Test',
        lastName: 'User'
      }
    };

    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null
    });

    await authenticateSupabaseToken(
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq).toHaveProperty('user', {
      id: mockUser.id,
      email: mockUser.email,
      userType: mockUser.user_metadata.userType,
      ...mockUser.user_metadata
    });
  });
}); 