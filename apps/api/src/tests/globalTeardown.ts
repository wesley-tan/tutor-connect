import { createMockContext } from './mocks';

export default async function globalTeardown() {
  const { prisma } = createMockContext();

  // Mock successful cleanup
  prisma.$transaction.mockResolvedValueOnce([
    { count: 0 }, // messages
    { count: 0 }, // conversations
    { count: 0 }, // sessions
    { count: 0 }, // reviews
    { count: 0 }, // tutorProfiles
    { count: 0 }, // tuteeProfiles
    { count: 0 }  // users
  ]);

  console.log('Test data cleanup complete');
} 