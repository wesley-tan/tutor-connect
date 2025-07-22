import { PrismaClient, Prisma } from '@tutorconnect/database';
import { BaseService } from './BaseService';

interface CreateSessionData {
  tutorId: string;
  subjectId: string;
  scheduledStart: string;
  scheduledEnd: string;
  sessionType: 'online' | 'in_person';
  notes: string | undefined;
}

interface UpdateSessionData {
  scheduledStart?: string | undefined;
  scheduledEnd?: string | undefined;
  actualStart?: string | undefined;
  actualEnd?: string | undefined;
  sessionType?: 'online' | 'in_person' | undefined;
  sessionNotes?: string | undefined;
  homeworkAssigned?: string | undefined;
  cancellationReason?: string | undefined;
  statusId?: number | undefined;
}

export class SessionService extends BaseService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async getUserSessions(userId: string, page: number = 1, limit: number = 10) {
    return this.executeWithLogging('getUserSessions', async () => {
      const { isTutor, profileId } = await this.validateUserProfile(userId);
      const { offset } = this.getPaginationData(page, limit);

      const [sessions, total] = await Promise.all([
        this.prisma.session.findMany({
          where: {
            [isTutor ? 'tutorId' : 'tuteeId']: profileId,
            deletedAt: null
          },
          include: {
            tutor: {
              include: {
                user: {
                  select: this.getDefaultUserSelect()
                }
              }
            },
            tutee: {
              include: {
                user: {
                  select: this.getDefaultUserSelect()
                }
              }
            },
            subject: true,
            status: true
          },
          orderBy: { scheduledStart: 'desc' },
          skip: offset,
          take: limit
        }),
        this.prisma.session.count({
          where: {
            [isTutor ? 'tutorId' : 'tuteeId']: profileId,
            deletedAt: null
          }
        })
      ]);

      return this.formatPaginationResponse(sessions, total, page, limit);
    });
  }

  async createSession(userId: string, data: CreateSessionData) {
    return this.executeWithLogging('createSession', async () => {
      const tuteeProfile = await this.prisma.tuteeProfile.findUnique({
        where: { userId }
      });

      if (!tuteeProfile) {
        throw new Error('Tutee profile not found');
      }

      const tutor = await this.prisma.tutorProfile.findUnique({
        where: { id: data.tutorId }
      });

      if (!tutor) {
        throw new Error('Tutor not found');
      }

      await this.checkSchedulingConflict(
        data.tutorId,
        new Date(data.scheduledStart),
        new Date(data.scheduledEnd)
      );

      return this.prisma.session.create({
        data: {
          tutee: { connect: { id: tuteeProfile.id } },
          tutor: { connect: { id: data.tutorId } },
          subject: { connect: { id: data.subjectId } },
          scheduledStart: new Date(data.scheduledStart),
          scheduledEnd: new Date(data.scheduledEnd),
          sessionType: data.sessionType,
          sessionNotes: data.notes || null,
          status: { connect: { id: 1 } } // Pending
        },
        include: {
          tutor: {
            include: {
              user: {
                select: this.getDefaultUserSelect()
              }
            }
          },
          tutee: {
            include: {
              user: {
                select: this.getDefaultUserSelect()
              }
            }
          },
          subject: true,
          status: true
        }
      });
    });
  }

  async updateSession(userId: string, sessionId: string, updates: UpdateSessionData) {
    return this.executeWithLogging('updateSession', async () => {
      const session = await this.validateUserAccess(userId, sessionId, 'session') as any;

      if (updates.scheduledStart || updates.scheduledEnd) {
        await this.checkSchedulingConflict(
          session.tutorId,
          new Date(updates.scheduledStart || session.scheduledStart),
          new Date(updates.scheduledEnd || session.scheduledEnd),
          session.id
        );
      }

      const updateData: Prisma.SessionUpdateInput = {};

      if (updates.scheduledStart) {
        updateData.scheduledStart = { set: new Date(updates.scheduledStart) };
      }
      if (updates.scheduledEnd) {
        updateData.scheduledEnd = { set: new Date(updates.scheduledEnd) };
      }
      if (updates.actualStart) {
        updateData.actualStart = { set: new Date(updates.actualStart) };
      }
      if (updates.actualEnd) {
        updateData.actualEnd = { set: new Date(updates.actualEnd) };
      }
      if (updates.sessionType) {
        updateData.sessionType = { set: updates.sessionType };
      }
      if (updates.sessionNotes) {
        updateData.sessionNotes = { set: updates.sessionNotes };
      }
      if (updates.homeworkAssigned) {
        updateData.homeworkAssigned = { set: updates.homeworkAssigned };
      }
      if (updates.cancellationReason) {
        updateData.cancellationReason = { set: updates.cancellationReason };
      }
      if (updates.statusId) {
        updateData.status = { connect: { id: updates.statusId } };
      }

      return this.prisma.session.update({
        where: { id: session.id },
        data: updateData,
        include: {
          tutor: {
            include: {
              user: {
                select: this.getDefaultUserSelect()
              }
            }
          },
          tutee: {
            include: {
              user: {
                select: this.getDefaultUserSelect()
              }
            }
          },
          subject: true,
          status: true
        }
      });
    });
  }

  async cancelSession(userId: string, sessionId: string, reason?: string) {
    return this.executeWithLogging('cancelSession', async () => {
      const session = await this.validateUserAccess(userId, sessionId, 'session') as any;

      await this.prisma.session.update({
        where: { id: session.id },
        data: {
          deletedAt: { set: new Date() },
          cancellationReason: { set: reason || null },
          status: { connect: { id: 4 } } // Cancelled
        }
      });

      return { success: true };
    });
  }
} 