import express, { Request, Response } from 'express';
import { prisma } from '@tutorconnect/database';
import { asyncHandler, successResponse, paginatedResponse } from '../middleware/errorHandlers';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../utils/supabaseAuth';
import { Prisma, User, TutorSubject } from '@prisma/client';

interface TutorWithProfile extends Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'profileImageUrl'> {
  tutorProfile: {
    id: string;
    hourlyRate: Prisma.Decimal;
    bio: string | null;
    ratingAverage: Prisma.Decimal;
    totalReviews: number;
    subjects: Array<{
      subject: {
        name: string;
      };
      proficiencyLevel: number;
    }>;
  } | null;
}

const router = express.Router();

// GET /api/v1/tutors - Search for tutors
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const skip = (page - 1) * limit;

  try {
    // Get filters from query params
    const { subject, minRating, maxPrice } = req.query;

    // Build where clause
    const where: Prisma.UserWhereInput = {
      userType: 'tutor',
      tutorProfile: {
        isVerified: true,
        ...(subject && {
          subjects: {
            some: {
              subject: {
                name: subject as string
              }
            }
          }
        }),
        ...(minRating && {
          ratingAverage: {
            gte: parseFloat(minRating as string)
          }
        }),
        ...(maxPrice && {
          hourlyRate: {
            lte: parseFloat(maxPrice as string)
          }
        })
      }
    };

    // Get total count
    const total = await prisma.user.count({ where });

    // Get tutors
    const tutors = await prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profileImageUrl: true,
        tutorProfile: {
          select: {
            id: true,
            hourlyRate: true,
            bio: true,
            ratingAverage: true,
            totalReviews: true,
            subjects: {
              select: {
                subject: {
                  select: {
                    name: true
                  }
                },
                proficiencyLevel: true
              }
            }
          }
        }
      },
      skip,
      take: limit,
      orderBy: {
        tutorProfile: {
          ratingAverage: 'desc'
        }
      }
    }) as TutorWithProfile[];

    // Transform data for response
    const formattedTutors = tutors.map(tutor => ({
      id: tutor.id,
      firstName: tutor.firstName,
      lastName: tutor.lastName,
      email: tutor.email,
      profileImageUrl: tutor.profileImageUrl,
      hourlyRate: tutor.tutorProfile?.hourlyRate || 0,
      bio: tutor.tutorProfile?.bio || '',
      rating: tutor.tutorProfile?.ratingAverage || 0,
      totalReviews: tutor.tutorProfile?.totalReviews || 0,
      subjects: tutor.tutorProfile?.subjects.map(s => ({
        name: s.subject.name,
        proficiencyLevel: s.proficiencyLevel
      })) || []
    }));

    return paginatedResponse(res, formattedTutors, total, page, limit, 'Tutors retrieved successfully');
  } catch (error) {
    logger.error('Error fetching tutors:', error);
    throw error;
  }
}));

// GET /api/v1/tutors/:id - Get tutor profile
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tutorId = req.params.id;

  if (!tutorId) {
    return res.status(400).json({
      success: false,
      message: 'Tutor ID is required'
    });
  }

  try {
    const tutor = await prisma.user.findFirst({
      where: {
        id: tutorId,
        userType: 'tutor' as const
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profileImageUrl: true,
        tutorProfile: {
          select: {
            id: true,
            hourlyRate: true,
            bio: true,
            ratingAverage: true,
            totalReviews: true,
            subjects: {
              select: {
                subject: {
                  select: {
                    name: true
                  }
                },
                proficiencyLevel: true
              }
            }
          }
        }
      }
    }) as TutorWithProfile | null;

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: 'Tutor not found'
      });
    }

    // Transform data for response
    const formattedTutor = {
      id: tutor.id,
      firstName: tutor.firstName,
      lastName: tutor.lastName,
      email: tutor.email,
      profileImageUrl: tutor.profileImageUrl,
      hourlyRate: tutor.tutorProfile?.hourlyRate || 0,
      bio: tutor.tutorProfile?.bio || '',
      rating: tutor.tutorProfile?.ratingAverage || 0,
      totalReviews: tutor.tutorProfile?.totalReviews || 0,
      subjects: tutor.tutorProfile?.subjects.map(s => ({
        name: s.subject.name,
        proficiencyLevel: s.proficiencyLevel
      })) || []
    };

    return successResponse(res, { tutor: formattedTutor }, 'Tutor profile retrieved successfully');
  } catch (error) {
    logger.error('Error fetching tutor profile:', error);
    throw error;
  }
}));

export default router; 