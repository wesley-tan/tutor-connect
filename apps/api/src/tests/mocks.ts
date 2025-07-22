import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@tutorconnect/database';

// Mock Prisma
export const prismaMock = mockDeep<PrismaClient>();
export type Context = {
  prisma: PrismaClient;
};
export type MockContext = {
  prisma: DeepMockProxy<PrismaClient>;
};
export const createMockContext = (): MockContext => {
  return {
    prisma: prismaMock
  };
};

// Mock Supabase
export const supabaseMock = {
  auth: {
    getUser: jest.fn(),
    refreshSession: jest.fn()
  }
}; 