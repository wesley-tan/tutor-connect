import { PrismaClient, Session, User, SessionStatus } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { SessionService } from '../services/SessionService';
import { logger } from '../utils/logger';

// Mock PrismaClient
const mockPrisma = mockDeep<PrismaClient>();
jest.mock('../utils/logger');

describe('SessionService', () => {
  let sessionService: SessionService;
  const mockUserId = 'user-1';
  const mockTutorId = 'tutor-1';
  const mockSessionId = 'session-1';

  const mockSession: Partial<Session> = {
    id: mockSessionId,
    tutorId: mockTutorId,
    tuteeId: mockUserId,
    scheduledStart: new Date(),
    scheduledEnd: new Date(),
    status: SessionStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockUser: Partial<User> = {
    id: mockUserId,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    isActive: true,
    isVerified: true
  };

  beforeEach(() => {
    sessionService = new SessionService(mockPrisma as unknown as PrismaClient);
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    const createSessionData = {
      tutorId: mockTutorId,
      tuteeId: mockUserId,
      scheduledStart: new Date(),
      scheduledEnd: new Date(),
      subject: 'Mathematics',
      sessionType: 'online'
    };

    it('should create a new session successfully', async () => {
      mockPrisma.session.create.mockResolvedValue(mockSession as Session);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as User);

      const result = await sessionService.createSession(mockUserId, createSessionData);

      expect(result).toEqual(mockSession);
      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tutorId: createSessionData.tutorId,
          tuteeId: createSessionData.tuteeId
        })
      });
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(sessionService.createSession(mockUserId, createSessionData))
        .rejects.toThrow('User not found');
    });

    it('should throw error if scheduling conflict exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as User);
      mockPrisma.session.findFirst.mockResolvedValue(mockSession as Session);

      await expect(sessionService.createSession(mockUserId, createSessionData))
        .rejects.toThrow('Scheduling conflict detected');
    });
  });

  describe('getSession', () => {
    it('should return session by id', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as Session);

      const result = await sessionService.getSession(mockSessionId);

      expect(result).toEqual(mockSession);
      expect(mockPrisma.session.findUnique).toHaveBeenCalledWith({
        where: { id: mockSessionId }
      });
    });

    it('should throw error if session not found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(sessionService.getSession(mockSessionId))
        .rejects.toThrow('Session not found');
    });
  });

  describe('updateSession', () => {
    const updateData = {
      status: SessionStatus.CONFIRMED,
      sessionNotes: 'Updated notes'
    };

    it('should update session successfully', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as Session);
      mockPrisma.session.update.mockResolvedValue({ ...mockSession, ...updateData } as Session);

      const result = await sessionService.updateSession(mockUserId, mockSessionId, updateData);

      expect(result).toEqual({ ...mockSession, ...updateData });
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: mockSessionId },
        data: updateData
      });
    });

    it('should throw error if session not found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(sessionService.updateSession(mockUserId, mockSessionId, updateData))
        .rejects.toThrow('Session not found');
    });

    it('should throw error if user not authorized', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        tuteeId: 'different-user',
        tutorId: 'different-tutor'
      } as Session);

      await expect(sessionService.updateSession(mockUserId, mockSessionId, updateData))
        .rejects.toThrow('Unauthorized access');
    });
  });

  describe('cancelSession', () => {
    it('should cancel session successfully', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(mockSession as Session);
      mockPrisma.session.update.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.CANCELLED
      } as Session);

      const result = await sessionService.cancelSession(mockUserId, mockSessionId);

      expect(result.status).toBe(SessionStatus.CANCELLED);
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: mockSessionId },
        data: { status: SessionStatus.CANCELLED }
      });
    });

    it('should throw error if session already cancelled', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.CANCELLED
      } as Session);

      await expect(sessionService.cancelSession(mockUserId, mockSessionId))
        .rejects.toThrow('Session is already cancelled');
    });
  });

  describe('getUserSessions', () => {
    it('should return user sessions with pagination', async () => {
      const mockSessions = [mockSession];
      const mockCount = 1;
      const page = 1;
      const limit = 10;

      mockPrisma.session.findMany.mockResolvedValue(mockSessions as Session[]);
      mockPrisma.session.count.mockResolvedValue(mockCount);

      const result = await sessionService.getUserSessions(mockUserId, { page, limit });

      expect(result.data).toEqual(mockSessions);
      expect(result.pagination).toEqual({
        page,
        limit,
        total: mockCount,
        totalPages: Math.ceil(mockCount / limit)
      });
    });

    it('should handle empty results', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.count.mockResolvedValue(0);

      const result = await sessionService.getUserSessions(mockUserId, { page: 1, limit: 10 });

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });
}); 