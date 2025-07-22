import { PrismaClient, Prisma } from '@tutorconnect/database';
import { logger } from '../utils/logger';

export class BaseService {
  constructor(protected prisma: PrismaClient) {}

  protected async executeWithLogging<T>(
    operation: string,
    func: () => Promise<T>
  ): Promise<T> {
    try {
      return await func();
    } catch (error) {
      logger.error(`Error in ${operation}:`, error);
      throw error;
    }
  }

  protected getPaginationData(page: number, limit: number) {
    const offset = (page - 1) * limit;
    return { offset, limit };
  }

  protected formatPaginationResponse<T>(
    data: T[],
    total: number,
    page: number,
    limit: number
  ) {
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  protected async validateUserProfile(userId: string) {
    const userProfile = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tutorProfile: true,
        tuteeProfile: true
      }
    });

    if (!userProfile) {
      throw new Error('User profile not found');
    }

    const isTutor = !!userProfile.tutorProfile;
    const profileId = isTutor ? userProfile.tutorProfile?.id : userProfile.tuteeProfile?.id;

    if (!profileId) {
      throw new Error('User profile not complete');
    }

    return {
      userProfile,
      isTutor,
      profileId
    };
  }

  protected async validateUserAccess(
    userId: string,
    resourceId: string,
    resourceType: 'session' | 'conversation' | 'review'
  ) {
    let resource;
    switch (resourceType) {
      case 'session':
        resource = await this.prisma.session.findFirst({
          where: {
            id: resourceId,
            OR: [
              { tutor: { user: { id: userId } } },
              { tutee: { user: { id: userId } } }
            ]
          }
        });
        break;
      case 'conversation':
        resource = await this.prisma.conversation.findFirst({
          where: {
            id: resourceId,
            OR: [
              { participantA: userId },
              { participantB: userId }
            ]
          }
        });
        break;
      case 'review':
        resource = await this.prisma.review.findFirst({
          where: {
            id: resourceId,
            OR: [
              { reviewerId: userId },
              { revieweeId: userId }
            ]
          }
        });
        break;
    }

    if (!resource) {
      throw new Error(`${resourceType} not found or access denied`);
    }

    return resource;
  }

  protected async checkSchedulingConflict(
    tutorId: string,
    startTime: Date,
    endTime: Date,
    excludeSessionId?: string
  ) {
    const conflict = await this.prisma.session.findFirst({
      where: {
        tutorId,
        ...(excludeSessionId && { id: { not: excludeSessionId } }),
        status: { id: { in: [1, 2, 3] } }, // Pending, Confirmed, In Progress
        OR: [
          {
            scheduledStart: { lte: startTime },
            scheduledEnd: { gt: startTime }
          },
          {
            scheduledStart: { lt: endTime },
            scheduledEnd: { gte: endTime }
          }
        ]
      } as Prisma.SessionWhereInput
    });

    if (conflict) {
      throw new Error('Scheduling conflict detected');
    }
  }

  protected getDefaultUserSelect() {
    return {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      profileImageUrl: true
    };
  }
} 