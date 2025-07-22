import { AuthService } from '../authService';
import { prismaMock } from '../../tests/setup';
import { mockUsers } from '../../tests/fixtures';

// Mock Google OAuth
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn()
  }))
}));

// Mock Supabase
const mockSupabase = {
  auth: {
    admin: {
      createUser: jest.fn(),
      generateLink: jest.fn()
    },
    getUser: jest.fn()
  }
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService();
  });

  describe('authenticateWithGoogle', () => {
    it('should authenticate existing user with Google', async () => {
      const mockTicket = {
        getPayload: () => ({
          email: mockUsers.tutor.email,
          given_name: mockUsers.tutor.firstName,
          family_name: mockUsers.tutor.lastName,
          picture: 'profile-pic-url'
        })
      };

      const mockGoogleClient = (authService as any).googleClient;
      mockGoogleClient.verifyIdToken.mockResolvedValue(mockTicket);

      prismaMock.user.findUnique.mockResolvedValue(mockUsers.tutor);
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'supabase-user-id' } },
        error: null
      });

      const result = await authService.authenticateWithGoogle('mock-id-token');

      expect(result.user).toEqual(mockUsers.tutor);
      expect(mockGoogleClient.verifyIdToken).toHaveBeenCalledWith({
        idToken: 'mock-id-token',
        audience: process.env.GOOGLE_CLIENT_ID || []
      });
    });

    it('should create new user on first Google login', async () => {
      const mockPayload = {
        email: 'newuser@test.com',
        given_name: 'New',
        family_name: 'User',
        picture: 'profile-pic-url'
      };

      const mockTicket = { getPayload: () => mockPayload };
      const mockGoogleClient = (authService as any).googleClient;
      mockGoogleClient.verifyIdToken.mockResolvedValue(mockTicket);

      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: mockPayload.email,
        firstName: mockPayload.given_name,
        lastName: mockPayload.family_name,
        userType: 'student',
        isVerified: true
      } as any);

      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'supabase-user-id' } },
        error: null
      });

      const result = await authService.authenticateWithGoogle('mock-id-token');

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          email: mockPayload.email,
          firstName: mockPayload.given_name,
          lastName: mockPayload.family_name,
          profileImageUrl: mockPayload.picture,
          userType: 'student',
          isVerified: true,
          passwordHash: ''
        }
      });
      expect(result.user.email).toBe(mockPayload.email);
    });

    it('should handle Google verification failure', async () => {
      const mockGoogleClient = (authService as any).googleClient;
      mockGoogleClient.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

      await expect(authService.authenticateWithGoogle('invalid-token'))
        .rejects.toThrow('Invalid token');
    });
  });

  describe('sendMagicLink', () => {
    it('should send magic link to existing user', async () => {
      const email = mockUsers.student.email;

      mockSupabase.auth.admin.generateLink.mockResolvedValue({
        data: {
          properties: { action_link: 'magic-link-url' }
        },
        error: null
      });

      prismaMock.user.findUnique.mockResolvedValue(mockUsers.student);

      const result = await authService.sendMagicLink(email);

      expect(result.user).toEqual(mockUsers.student);
      expect(mockSupabase.auth.admin.generateLink).toHaveBeenCalledWith({
        type: 'magiclink',
        email,
        options: {
          redirectTo: `${process.env.FRONTEND_URL}/auth/callback`
        }
      });
    });

    it('should create new user when sending magic link', async () => {
      const email = 'newuser@test.com';

      mockSupabase.auth.admin.generateLink.mockResolvedValue({
        data: {
          properties: { action_link: 'magic-link-url' }
        },
        error: null
      });

      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({
        id: 'new-user-id',
        email,
        firstName: '',
        lastName: '',
        userType: 'student',
        isVerified: false
      } as any);

      const result = await authService.sendMagicLink(email);

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          email,
          firstName: '',
          lastName: '',
          userType: 'student',
          isVerified: false,
          passwordHash: ''
        }
      });
      expect(result.user.email).toBe(email);
    });

    it('should handle Supabase error', async () => {
      const email = 'test@test.com';

      mockSupabase.auth.admin.generateLink.mockResolvedValue({
        data: null,
        error: { message: 'Supabase error' }
      });

      await expect(authService.sendMagicLink(email))
        .rejects.toMatchObject({ message: 'Supabase error' });
    });
  });

  describe('verifySession', () => {
    it('should verify valid session', async () => {
      const token = 'valid-token';
      const mockSupabaseUser = {
        id: 'supabase-user-id',
        email: mockUsers.tutor.email
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockSupabaseUser },
        error: null
      });

      prismaMock.user.findUnique.mockResolvedValue(mockUsers.tutor);

      const result = await authService.verifySession(token);

      expect(result.user).toEqual(mockUsers.tutor);
      expect(result.session).toEqual(mockSupabaseUser);
    });

    it('should reject invalid session', async () => {
      const token = 'invalid-token';

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      });

      await expect(authService.verifySession(token))
        .rejects.toMatchObject({ message: 'Invalid token' });
    });

    it('should handle user not found in database', async () => {
      const token = 'valid-token';
      const mockSupabaseUser = {
        id: 'supabase-user-id',
        email: 'unknown@test.com'
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockSupabaseUser },
        error: null
      });

      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(authService.verifySession(token))
        .rejects.toThrow('User not found');
    });
  });
}); 