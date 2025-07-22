import { createMockContext } from './mocks';
import { Decimal } from '@prisma/client/runtime/library';
import { UserType } from '@tutorconnect/database';

export default async function globalSetup() {
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

  // Mock successful user creation
  const mockTutorUser = {
    id: 'test-tutor-1',
    email: 'tutor1@test.com',
    firstName: 'Test',
    lastName: 'Tutor',
    userType: UserType.tutor,
    passwordHash: 'test-password-hash',
    phone: null,
    profileImageUrl: null,
    timezone: 'UTC',
    isVerified: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    tutorProfile: {
      id: 'tutor-profile-1',
      userId: 'test-tutor-1',
      hourlyRate: new Decimal(50),
      teachingExperienceYears: 5,
      bio: 'Test tutor bio',
      isVerified: true,
      educationLevel: null,
      university: null,
      major: null,
      graduationYear: null,
      teachingMethodology: null,
      availabilityTimezone: 'UTC',
      ratingAverage: new Decimal(0),
      totalReviews: 0,
      totalSessions: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  };

  const mockTuteeUser = {
    id: 'test-tutee-1',
    email: 'tutee1@test.com',
    firstName: 'Test',
    lastName: 'Tutee',
    userType: UserType.student,
    passwordHash: 'test-password-hash',
    phone: null,
    profileImageUrl: null,
    timezone: 'UTC',
    isVerified: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    tuteeProfile: {
      id: 'tutee-profile-1',
      userId: 'test-tutee-1',
      gradeLevel: '12th',
      schoolName: 'Test High School',
      learningStyle: null,
      budgetMin: null,
      budgetMax: null,
      preferredSessionLength: 60,
      locationCity: null,
      locationState: null,
      parentId: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  };

  prisma.user.create.mockResolvedValueOnce(mockTutorUser);
  prisma.user.create.mockResolvedValueOnce(mockTuteeUser);

  console.log('Test data setup complete');
} 