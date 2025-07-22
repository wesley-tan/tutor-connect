import { PrismaClient } from '@tutorconnect/database';
import { mockDeep } from 'jest-mock-extended';
import { Request, Response } from 'express';

// Mock Prisma
export const mockPrisma = mockDeep<PrismaClient>();
jest.mock('@tutorconnect/database', () => ({
  __esModule: true,
  PrismaClient: jest.fn(() => mockPrisma),
  prisma: mockPrisma,
  UserType: {
    student: 'student',
    tutor: 'tutor'
  },
  RequestUrgency: {
    low: 'low',
    normal: 'normal',
    high: 'high',
    urgent: 'urgent'
  },
  RequestStatus: {
    open: 'open',
    in_progress: 'in_progress',
    completed: 'completed',
    cancelled: 'cancelled'
  }
}));

// Mock Supabase
export const mockSupabase = {
  auth: {
    getUser: jest.fn(),
    admin: {
      createUser: jest.fn(),
      generateLink: jest.fn()
    }
  }
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

// Mock auth middleware
export const mockAuth = (req: Request, res: Response, next: Function) => {
  (req as any).user = {
    id: 'test-user-1',
    email: 'test@example.com',
    userType: 'student'
  };
  next();
};

jest.mock('./src/utils/supabaseAuth', () => ({
  authenticateSupabaseToken: mockAuth,
  mockAuth
}));

// Mock environment variables
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key'; 