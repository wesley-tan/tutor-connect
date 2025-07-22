import { PrismaClient } from '@tutorconnect/database';
import { SessionService } from '../SessionService';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

jest.mock('@tutorconnect/database', () => ({
  PrismaClient: jest.fn()
}));

describe('SessionService', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let sessionService: SessionService;

  const mockUser = {
    id: 'user1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    userType: 'student' as const
  };

  const mockTutorProfile = {
    id: 'tutor1',
    userId: 'tutor-user1',
    hourlyRate: 50,
    bio: 'Experienced tutor'
  };

  const mockTuteeProfile = {
    id: 'tutee1',
    userId: 'user1',
    gradeLevel: '12th',
    schoolName: 'Test School'
  };

  const mockSession = {
    id: 'session1',
    tutorId: 'tutor1',
    tuteeId: 'tutee1',
    subjectId: 'subject1',
    scheduledStart: new Date('2024-02-01T10:00:00Z'),
    scheduledEnd: new Date('2024-02-01T11:00:00Z'),
    actualStart: null,
    actualEnd: null,
    sessionType: 'online' as const,
    sessionNotes: 'Test session',
    homeworkAssigned: null,
    cancellationReason: null,
    deletedAt: null,
    status: { id: 1, name: 'Pending' },
    tutor: {
      ...mockTutorProfile,
      user: mockUser
    },
    tutee: {
      ...mockTuteeProfile,
      user: mockUser
    },
    subject: { id: 'subject1', name: 'Mathematics' }
  };

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    sessionService = new SessionService(prisma);
  });

  afterEach(() => {
    mockReset(prisma);
  });

  describe('getUserSessions', () => {
    it('should get sessions for a tutor', async () => {
      // Mock user profile
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        userType: 'tutor',
        tutorProfile: mockTutorProfile,
        tuteeProfile: null
      } as any);

      // Mock sessions
      prisma.session.findMany.mockResolvedValueOnce([mockSession] as any);
      prisma.session.count.mockResolvedValueOnce(1);

      const result = await sessionService.getUserSessions('tutor-user1');

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tutorId: 'tutor1',
            deletedAt: null
          },
          include: expect.any(Object),
          orderBy: { scheduledStart: 'desc' },
          skip: 0,
          take: 10
        })
      );
    });

    it('should get sessions for a tutee', async () => {
      // Mock user profile
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        userType: 'student',
        tutorProfile: null,
        tuteeProfile: mockTuteeProfile
      } as any);

      // Mock sessions
      prisma.session.findMany.mockResolvedValueOnce([mockSession] as any);
      prisma.session.count.mockResolvedValueOnce(1);

      const result = await sessionService.getUserSessions('user1');

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tuteeId: 'tutee1',
            deletedAt: null
          }
        })
      );
    });

    it('should handle pagination correctly', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        userType: 'student',
        tuteeProfile: mockTuteeProfile
      } as any);

      prisma.session.findMany.mockResolvedValueOnce([] as any);
      prisma.session.count.mockResolvedValueOnce(25);

      const result = await sessionService.getUserSessions('user1', 2, 5);

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(5);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(5);
      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5
        })
      );
    });

    it('should return empty array when no sessions exist', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        userType: 'student',
        tuteeProfile: mockTuteeProfile
      } as any);

      prisma.session.findMany.mockResolvedValueOnce([] as any);
      prisma.session.count.mockResolvedValueOnce(0);

      const result = await sessionService.getUserSessions('user1');

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should throw error for user without profile', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        userType: 'student',
        tutorProfile: null,
        tuteeProfile: null
      } as any);

      await expect(sessionService.getUserSessions('user1')).rejects.toThrow(
        'User profile not found'
      );
    });

    it('should handle database errors gracefully', async () => {
      prisma.user.findUnique.mockRejectedValueOnce(new Error('Database error'));

      await expect(sessionService.getUserSessions('user1')).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('createSession', () => {
    const createSessionData = {
      tutorId: 'tutor1',
      subjectId: 'subject1',
      scheduledStart: '2024-02-01T10:00:00Z',
      scheduledEnd: '2024-02-01T11:00:00Z',
      sessionType: 'online' as const,
      notes: 'Test session notes'
    };

    it('should create session successfully', async () => {
      prisma.tuteeProfile.findUnique.mockResolvedValueOnce(mockTuteeProfile as any);
      prisma.tutorProfile.findUnique.mockResolvedValueOnce(mockTutorProfile as any);
      prisma.session.findMany.mockResolvedValueOnce([] as any); // No conflicts
      prisma.session.create.mockResolvedValueOnce(mockSession as any);

      const result = await sessionService.createSession('user1', createSessionData);

      expect(result).toEqual(mockSession);
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: {
          tutee: { connect: { id: 'tutee1' } },
          tutor: { connect: { id: 'tutor1' } },
          subject: { connect: { id: 'subject1' } },
          scheduledStart: new Date(createSessionData.scheduledStart),
          scheduledEnd: new Date(createSessionData.scheduledEnd),
          sessionType: 'online',
          sessionNotes: 'Test session notes',
          status: { connect: { id: 1 } }
        },
        include: expect.any(Object)
      });
    });

    it('should throw error when tutee profile not found', async () => {
      prisma.tuteeProfile.findUnique.mockResolvedValueOnce(null);

      await expect(sessionService.createSession('user1', createSessionData))
        .rejects.toThrow('Tutee profile not found');
    });

    it('should throw error when tutor not found', async () => {
      prisma.tuteeProfile.findUnique.mockResolvedValueOnce(mockTuteeProfile as any);
      prisma.tutorProfile.findUnique.mockResolvedValueOnce(null);

      await expect(sessionService.createSession('user1', createSessionData))
        .rejects.toThrow('Tutor not found');
    });

    it('should throw error when scheduling conflict exists', async () => {
      const conflictingSession = {
        ...mockSession,
        scheduledStart: new Date('2024-02-01T10:30:00Z'),
        scheduledEnd: new Date('2024-02-01T11:30:00Z')
      };

      prisma.tuteeProfile.findUnique.mockResolvedValueOnce(mockTuteeProfile as any);
      prisma.tutorProfile.findUnique.mockResolvedValueOnce(mockTutorProfile as any);
      prisma.session.findMany.mockResolvedValueOnce([conflictingSession] as any);

      await expect(sessionService.createSession('user1', createSessionData))
        .rejects.toThrow('Scheduling conflict detected');
    });

    it('should handle null notes', async () => {
      const dataWithoutNotes = { ...createSessionData, notes: undefined };
      
      prisma.tuteeProfile.findUnique.mockResolvedValueOnce(mockTuteeProfile as any);
      prisma.tutorProfile.findUnique.mockResolvedValueOnce(mockTutorProfile as any);
      prisma.session.findMany.mockResolvedValueOnce([] as any);
      prisma.session.create.mockResolvedValueOnce(mockSession as any);

      await sessionService.createSession('user1', dataWithoutNotes);

      expect(prisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionNotes: null
          })
        })
      );
    });

    it('should validate date formats', async () => {
      const invalidData = {
        ...createSessionData,
        scheduledStart: 'invalid-date',
        scheduledEnd: 'invalid-date'
      };

      prisma.tuteeProfile.findUnique.mockResolvedValueOnce(mockTuteeProfile as any);
      prisma.tutorProfile.findUnique.mockResolvedValueOnce(mockTutorProfile as any);
      prisma.session.findMany.mockResolvedValueOnce([] as any);

      await expect(sessionService.createSession('user1', invalidData))
        .rejects.toThrow();
    });
  });

  describe('updateSession', () => {
    const updateData = {
      scheduledStart: '2024-02-01T11:00:00Z',
      scheduledEnd: '2024-02-01T12:00:00Z',
      sessionNotes: 'Updated notes'
    };

    it('should update session successfully', async () => {
      const updatedSession = { ...mockSession, ...updateData };

      prisma.session.findFirst.mockResolvedValueOnce(mockSession as any);
      prisma.session.findMany.mockResolvedValueOnce([] as any); // No conflicts
      prisma.session.update.mockResolvedValueOnce(updatedSession as any);

      const result = await sessionService.updateSession('user1', 'session1', updateData);

      expect(result).toEqual(updatedSession);
      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session1' },
        data: expect.objectContaining({
          scheduledStart: { set: new Date(updateData.scheduledStart) },
          scheduledEnd: { set: new Date(updateData.scheduledEnd) },
          sessionNotes: { set: updateData.sessionNotes }
        }),
        include: expect.any(Object)
      });
    });

    it('should throw error when session not found', async () => {
      prisma.session.findFirst.mockResolvedValueOnce(null);

      await expect(sessionService.updateSession('user1', 'session1', updateData))
        .rejects.toThrow('Session not found');
    });

    it('should throw error when user not authorized', async () => {
      const unauthorizedSession = {
        ...mockSession,
        tutorId: 'different-tutor',
        tuteeId: 'different-tutee'
      };

      prisma.session.findFirst.mockResolvedValueOnce(unauthorizedSession as any);

      await expect(sessionService.updateSession('user1', 'session1', updateData))
        .rejects.toThrow('Unauthorized access to session');
    });

    it('should check for scheduling conflicts when updating times', async () => {
      const conflictingSession = {
        ...mockSession,
        id: 'session2',
        scheduledStart: new Date('2024-02-01T11:30:00Z'),
        scheduledEnd: new Date('2024-02-01T12:30:00Z')
      };

      prisma.session.findFirst.mockResolvedValueOnce(mockSession as any);
      prisma.session.findMany.mockResolvedValueOnce([conflictingSession] as any);

      await expect(sessionService.updateSession('user1', 'session1', updateData))
        .rejects.toThrow('Scheduling conflict detected');
    });

    it('should handle partial updates', async () => {
      const partialUpdate = { sessionNotes: 'Only notes updated' };

      prisma.session.findFirst.mockResolvedValueOnce(mockSession as any);
      prisma.session.update.mockResolvedValueOnce(mockSession as any);

      await sessionService.updateSession('user1', 'session1', partialUpdate);

      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionNotes: { set: partialUpdate.sessionNotes }
          })
        })
      );
    });

    it('should handle status updates', async () => {
      const statusUpdate = { statusId: 2 };

      prisma.session.findFirst.mockResolvedValueOnce(mockSession as any);
      prisma.session.update.mockResolvedValueOnce(mockSession as any);

      await sessionService.updateSession('user1', 'session1', statusUpdate);

      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: { connect: { id: 2 } }
          })
        })
      );
    });

    it('should handle actual start/end times', async () => {
      const timeUpdate = {
        actualStart: '2024-02-01T10:05:00Z',
        actualEnd: '2024-02-01T11:05:00Z'
      };

      prisma.session.findFirst.mockResolvedValueOnce(mockSession as any);
      prisma.session.update.mockResolvedValueOnce(mockSession as any);

      await sessionService.updateSession('user1', 'session1', timeUpdate);

      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actualStart: { set: new Date(timeUpdate.actualStart) },
            actualEnd: { set: new Date(timeUpdate.actualEnd) }
          })
        })
      );
    });
  });

  describe('cancelSession', () => {
    it('should cancel session successfully', async () => {
      prisma.session.findFirst.mockResolvedValueOnce(mockSession as any);
      prisma.session.update.mockResolvedValueOnce(mockSession as any);

      const result = await sessionService.cancelSession('user1', 'session1', 'Emergency');

      expect(result).toEqual({ success: true });
      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session1' },
        data: {
          deletedAt: { set: expect.any(Date) },
          cancellationReason: { set: 'Emergency' },
          status: { connect: { id: 4 } }
        }
      });
    });

    it('should cancel session without reason', async () => {
      prisma.session.findFirst.mockResolvedValueOnce(mockSession as any);
      prisma.session.update.mockResolvedValueOnce(mockSession as any);

      const result = await sessionService.cancelSession('user1', 'session1');

      expect(result).toEqual({ success: true });
      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session1' },
        data: {
          deletedAt: { set: expect.any(Date) },
          cancellationReason: { set: null },
          status: { connect: { id: 4 } }
        }
      });
    });

    it('should throw error when session not found', async () => {
      prisma.session.findFirst.mockResolvedValueOnce(null);

      await expect(sessionService.cancelSession('user1', 'session1'))
        .rejects.toThrow('Session not found');
    });

    it('should throw error when user not authorized', async () => {
      const unauthorizedSession = {
        ...mockSession,
        tutorId: 'different-tutor',
        tuteeId: 'different-tutee'
      };

      prisma.session.findFirst.mockResolvedValueOnce(unauthorizedSession as any);

      await expect(sessionService.cancelSession('user1', 'session1'))
        .rejects.toThrow('Unauthorized access to session');
    });

    it('should handle already cancelled sessions', async () => {
      const cancelledSession = {
        ...mockSession,
        deletedAt: new Date()
      };

      prisma.session.findFirst.mockResolvedValueOnce(cancelledSession as any);
      prisma.session.update.mockResolvedValueOnce(cancelledSession as any);

      const result = await sessionService.cancelSession('user1', 'session1');

      expect(result).toEqual({ success: true });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle concurrent session operations', async () => {
      prisma.session.findFirst.mockResolvedValue(mockSession as any);
      prisma.session.update.mockResolvedValue(mockSession as any);

      const promises = [
        sessionService.updateSession('user1', 'session1', { sessionNotes: 'Update 1' }),
        sessionService.updateSession('user1', 'session1', { sessionNotes: 'Update 2' })
      ];

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    it('should handle database connection errors', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('Connection lost'));

      await expect(sessionService.getUserSessions('user1'))
        .rejects.toThrow('Connection lost');
    });

    it('should handle invalid session IDs', async () => {
      prisma.session.findFirst.mockResolvedValue(null);

      await expect(sessionService.updateSession('user1', 'invalid-id', {}))
        .rejects.toThrow('Session not found');
    });

    it('should handle malformed date strings', async () => {
      const invalidData = {
        tutorId: 'tutor1',
        subjectId: 'subject1',
        scheduledStart: 'not-a-date',
        scheduledEnd: 'not-a-date',
        sessionType: 'online' as const,
        notes: 'Test'
      };

      prisma.tuteeProfile.findUnique.mockResolvedValue(mockTuteeProfile as any);
      prisma.tutorProfile.findUnique.mockResolvedValue(mockTutorProfile as any);

      await expect(sessionService.createSession('user1', invalidData))
        .rejects.toThrow();
    });

    it('should handle very long session notes', async () => {
      const longNotes = 'x'.repeat(10000);
      const updateData = { sessionNotes: longNotes };

      prisma.session.findFirst.mockResolvedValue(mockSession as any);
      prisma.session.update.mockResolvedValue(mockSession as any);

      const result = await sessionService.updateSession('user1', 'session1', updateData);

      expect(result).toBeDefined();
      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionNotes: { set: longNotes }
          })
        })
      );
    });

    it('should handle timezone differences in scheduling', async () => {
      const utcData = {
        tutorId: 'tutor1',
        subjectId: 'subject1',
        scheduledStart: '2024-02-01T10:00:00Z',
        scheduledEnd: '2024-02-01T11:00:00Z',
        sessionType: 'online' as const,
        notes: 'UTC time'
      };

      prisma.tuteeProfile.findUnique.mockResolvedValue(mockTuteeProfile as any);
      prisma.tutorProfile.findUnique.mockResolvedValue(mockTutorProfile as any);
      prisma.session.findMany.mockResolvedValue([] as any);
      prisma.session.create.mockResolvedValue(mockSession as any);

      const result = await sessionService.createSession('user1', utcData);

      expect(result).toBeDefined();
      expect(prisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scheduledStart: new Date('2024-02-01T10:00:00Z'),
            scheduledEnd: new Date('2024-02-01T11:00:00Z')
          })
        })
      );
    });
  });

  describe('Validation and Business Logic', () => {
    it('should validate session duration', async () => {
      const invalidData = {
        tutorId: 'tutor1',
        subjectId: 'subject1',
        scheduledStart: '2024-02-01T10:00:00Z',
        scheduledEnd: '2024-02-01T09:00:00Z', // End before start
        sessionType: 'online' as const,
        notes: 'Test'
      };

      prisma.tuteeProfile.findUnique.mockResolvedValue(mockTuteeProfile as any);
      prisma.tutorProfile.findUnique.mockResolvedValue(mockTutorProfile as any);

      await expect(sessionService.createSession('user1', invalidData))
        .rejects.toThrow();
    });

    it('should handle different session types', async () => {
      const inPersonData = {
        ...createSessionData,
        sessionType: 'in_person' as const
      };

      prisma.tuteeProfile.findUnique.mockResolvedValue(mockTuteeProfile as any);
      prisma.tutorProfile.findUnique.mockResolvedValue(mockTutorProfile as any);
      prisma.session.findMany.mockResolvedValue([] as any);
      prisma.session.create.mockResolvedValue(mockSession as any);

      await sessionService.createSession('user1', inPersonData);

      expect(prisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionType: 'in_person'
          })
        })
      );
    });

    it('should handle homework assignment updates', async () => {
      const homeworkUpdate = { homeworkAssigned: 'Complete exercises 1-10' };

      prisma.session.findFirst.mockResolvedValue(mockSession as any);
      prisma.session.update.mockResolvedValue(mockSession as any);

      await sessionService.updateSession('user1', 'session1', homeworkUpdate);

      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            homeworkAssigned: { set: homeworkUpdate.homeworkAssigned }
          })
        })
      );
    });
  });
}); 