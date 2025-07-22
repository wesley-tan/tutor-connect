import { User, TutorProfile, TuteeProfile } from '@tutorconnect/database';
import { Decimal } from '@prisma/client/runtime/library';

export const mockUsers = {
  tutor: {
    id: 'test-tutor-1',
    email: 'tutor@test.com',
    firstName: 'John',
    lastName: 'Tutor',
    userType: 'tutor' as const,
    passwordHash: 'hashed-password',
    phone: '+1234567890',
    profileImageUrl: null,
    timezone: 'UTC',
    isVerified: true,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null
  } as User,

  student: {
    id: 'test-student-1',
    email: 'student@test.com',
    firstName: 'Jane',
    lastName: 'Student',
    userType: 'student' as const,
    passwordHash: 'hashed-password',
    phone: '+1234567891',
    profileImageUrl: null,
    timezone: 'UTC',
    isVerified: true,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null
  } as User
};

export const mockTutorProfile = {
  id: 'tutor-profile-1',
  userId: 'test-tutor-1',
  hourlyRate: new Decimal(50),
  teachingExperienceYears: 5,
  bio: 'Experienced math tutor',
  isVerified: true,
  educationLevel: 'Bachelor',
  university: 'Test University',
  major: 'Mathematics',
  graduationYear: 2020,
  teachingMethodology: 'Interactive learning',
  availabilityTimezone: 'UTC',
  ratingAverage: new Decimal(4.5),
  totalReviews: 10,
  totalSessions: 50,
  isBackgroundChecked: false,
  backgroundCheckDate: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
} as TutorProfile;

export const mockTuteeProfile = {
  id: 'tutee-profile-1',
  userId: 'test-student-1',
  gradeLevel: '12th',
  schoolName: 'Test High School',
  learningStyle: 'visual' as const,
  budgetMin: new Decimal(20),
  budgetMax: new Decimal(60),
  preferredSessionLength: 60,
  locationCity: 'Test City',
  locationState: 'Test State',
  parentId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
} as TuteeProfile;

export const mockConversation = {
  id: 'conversation-1',
  participantA: 'test-tutor-1',
  participantB: 'test-student-1',
  lastMessageAt: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
};

export const mockMessage = {
  id: 'message-1',
  conversationId: 'conversation-1',
  senderId: 'test-student-1',
  receiverId: 'test-tutor-1',
  messageText: 'Hello, can you help me with math?',
  messageType: 'text' as const,
  fileUrl: null,
  isRead: false,
  readAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
};

export const mockSession = {
  id: 'session-1',
  tutorId: 'tutor-profile-1',
  tuteeId: 'tutee-profile-1',
  subjectId: 'subject-1',
  scheduledStart: new Date('2024-02-01T10:00:00Z'),
  scheduledEnd: new Date('2024-02-01T11:00:00Z'),
  actualStart: null,
  actualEnd: null,
  status: 'scheduled' as const,
  sessionNotes: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
};

export const createMockRequest = (user: User) => ({
  user,
  headers: {
    authorization: 'Bearer mock-token'
  }
}); 