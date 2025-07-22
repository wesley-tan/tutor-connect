import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

export const prismaMock = mockDeep<PrismaClient>();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => prismaMock)
}));