import express, { Request, Response } from 'express';
import { prisma } from '@tutorconnect/database';
import { asyncHandler, successResponse, paginatedResponse, ValidationError, NotFoundError } from '../middleware/errorHandlers';
import { authenticateSupabaseToken, requireRole, AuthenticatedRequest } from '../utils/supabaseAuth';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const TutorSearchSchema = z.object({
  subject: z.string().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  maxHourlyRate: z.coerce.number().min(0).optional(),
  availability: z.string().optional(), // day of week
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10)
});

const TutorProfileUpdateSchema = z.object({
  hourlyRate: z.number().min(0).optional(),
  educationLevel: z.string().optional(),
  university: z.string().optional(),
  major: z.string().optional(),
  graduationYear: z.number().optional(),
  teachingExperienceYears: z.number().min(0).optional(),
  bio: z.string().optional(),
  teachingMethodology: z.string().optional(),
  availabilityTimezone: z.string().optional()
});

const AvailabilitySchema = z.object({
  availability: z.array(z.object({
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    endTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    isAvailable: z.boolean().default(true)
  }))
});

// GET /api/v1/tutors - Search/filter tutors
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const query = TutorSearchSchema.parse(req.query);
  const { page, limit, subject, minRating, maxHourlyRate, availability } = query;
  const offset = (page - 1) * limit;

  // Build where conditions
  const where: any = {
    user: { isActive: true },
    isVerified: true
  };

  if (minRating) {
    where.ratingAverage = { gte: minRating };
  }

  if (maxHourlyRate) {
    where.hourlyRate = { lte: maxHourlyRate };
  }

  // Subject filter through tutor subjects relationship
  if (subject) {
    where.subjects = {
      some: {
        subject: {
          name: { contains: subject, mode: 'insensitive' }
        }
      }
    };
  }

  // Availability filter
  if (availability) {
    const dayOfWeek = parseInt(availability);
    where.availability = {
      some: {
        dayOfWeek,
        isAvailable: true
      }
    };
  }

  const [tutors, total] = await Promise.all([
    prisma.tutorProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImageUrl: true
          }
        },
        subjects: {
          include: { subject: true }
        },
        certifications: {
          include: { certification: true }
        },
        languages: true
      },
      skip: offset,
      take: limit,
      orderBy: [
        { ratingAverage: 'desc' },
        { totalReviews: 'desc' }
      ]
    }),
    prisma.tutorProfile.count({ where })
  ]);

  paginatedResponse(res, tutors, total, page, limit, 'Tutors retrieved successfully');
}));

// GET /api/v1/tutors/:id - Get tutor details
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tutorId = req.params.id;

  const tutor = await prisma.tutorProfile.findUnique({
    where: { id: tutorId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImageUrl: true,
          timezone: true
        }
      },
      subjects: {
        include: { subject: true }
      },
      certifications: {
        include: { certification: true }
      },
      specializations: true,
      languages: true,
      availability: {
        where: { isAvailable: true },
        orderBy: { dayOfWeek: 'asc' }
      }
    }
  });

  if (!tutor) {
    throw new NotFoundError('Tutor not found');
  }

  successResponse(res, { tutor }, 'Tutor details retrieved successfully');
}));

// PUT /api/v1/tutors/:id - Update tutor profile (only by tutor themselves)
router.put('/:id', authenticateSupabaseToken, requireRole('tutor'), asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const tutorId = req.params.id;
  const validatedData = TutorProfileUpdateSchema.parse(req.body);

  // Verify tutor owns this profile
  const existingProfile = await prisma.tutorProfile.findUnique({
    where: { id: tutorId, userId: user.id }
  });

  if (!existingProfile) {
    throw new NotFoundError('Tutor profile not found or unauthorized');
  }

  const updatedProfile = await prisma.tutorProfile.update({
    where: { id: tutorId },
    data: validatedData,
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  successResponse(res, { profile: updatedProfile }, 'Tutor profile updated successfully');
}));

// GET /api/v1/tutors/:id/availability - Get tutor availability
router.get('/:id/availability', asyncHandler(async (req: Request, res: Response) => {
  const tutorId = req.params.id;

  const availability = await prisma.tutorAvailability.findMany({
    where: { tutorId },
    orderBy: [
      { dayOfWeek: 'asc' },
      { startTime: 'asc' }
    ]
  });

  successResponse(res, { availability }, 'Tutor availability retrieved successfully');
}));

// PUT /api/v1/tutors/:id/availability - Update tutor availability (only by tutor themselves)
router.put('/:id/availability', authenticateSupabaseToken, requireRole('tutor'), asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const tutorId = req.params.id;
  const { availability } = AvailabilitySchema.parse(req.body);

  // Verify tutor owns this profile
  const tutorProfile = await prisma.tutorProfile.findUnique({
    where: { id: tutorId, userId: user.id }
  });

  if (!tutorProfile) {
    throw new NotFoundError('Tutor profile not found or unauthorized');
  }

  // Delete existing availability and create new ones
  await prisma.$transaction(async (tx: any) => {
    await tx.tutorAvailability.deleteMany({
      where: { tutorId }
    });

    await tx.tutorAvailability.createMany({
      data: availability.map(slot => ({
        tutorId,
        ...slot
      }))
    });
  });

  const updatedAvailability = await prisma.tutorAvailability.findMany({
    where: { tutorId },
    orderBy: [
      { dayOfWeek: 'asc' },
      { startTime: 'asc' }
    ]
  });

  successResponse(res, { availability: updatedAvailability }, 'Tutor availability updated successfully');
}));

// GET /api/v1/tutors/:id/reviews - Get tutor reviews
router.get('/:id/reviews', asyncHandler(async (req: Request, res: Response) => {
  const tutorId = req.params.id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);
  const offset = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { revieweeId: tutorId },
      include: {
        reviewer: {
          select: {
            firstName: true,
            lastName: true,
            profileImageUrl: true
          }
        },
        session: {
          select: {
            id: true,
            scheduledStart: true,
            subject: {
              select: { name: true }
            }
          }
        }
      },
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.review.count({ where: { revieweeId: tutorId } })
  ]);

  paginatedResponse(res, reviews, total, page, limit, 'Tutor reviews retrieved successfully');
}));

// GET /api/v1/tutors/:id/analytics - Tutor analytics (only by tutor themselves)
router.get('/:id/analytics', authenticateSupabaseToken, requireRole('tutor'), asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const tutorId = req.params.id;

  // Verify tutor owns this profile
  const tutorProfile = await prisma.tutorProfile.findUnique({
    where: { id: tutorId, userId: user.id }
  });

  if (!tutorProfile) {
    throw new NotFoundError('Tutor profile not found or unauthorized');
  }

  // Get analytics data
  const [
    totalSessions,
    completedSessions,
    totalEarnings,
    averageRating,
    recentSessions
  ] = await Promise.all([
    prisma.session.count({
      where: { tutorId }
    }),
    prisma.session.count({
      where: { tutorId, status: 'completed' }
    }),
    prisma.payment.aggregate({
      where: {
        session: { tutorId },
        status: 'succeeded'
      },
      _sum: { netAmount: true }
    }),
    prisma.review.aggregate({
      where: { revieweeId: tutorId },
      _avg: { rating: true }
    }),
    prisma.session.findMany({
      where: { tutorId },
      include: {
        tutee: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        subject: { select: { name: true } }
      },
      orderBy: { scheduledStart: 'desc' },
      take: 5
    })
  ]);

  const analytics = {
    totalSessions,
    completedSessions,
    totalEarnings: totalEarnings._sum.netAmount || 0,
    averageRating: averageRating._avg.rating || 0,
    recentSessions
  };

  successResponse(res, { analytics }, 'Tutor analytics retrieved successfully');
}));

// POST /api/v1/tutors/:id/subjects - Add/update tutor subjects
router.post('/:id/subjects', authenticateSupabaseToken, requireRole('tutor'), asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const tutorId = req.params.id;
  const { subjects } = z.object({
    subjects: z.array(z.object({
      subjectId: z.string(),
      proficiencyLevel: z.number().min(1).max(5),
      yearsExperience: z.number().min(0)
    }))
  }).parse(req.body);

  // Verify tutor owns this profile
  const tutorProfile = await prisma.tutorProfile.findUnique({
    where: { id: tutorId, userId: user.id }
  });

  if (!tutorProfile) {
    throw new NotFoundError('Tutor profile not found or unauthorized');
  }

  // Update tutor subjects
  await prisma.$transaction(async (tx: any) => {
    // Delete existing subjects
    await tx.tutorSubject.deleteMany({
      where: { tutorId }
    });

    // Create new subjects
    await tx.tutorSubject.createMany({
      data: subjects.map(subject => ({
        tutorId,
        ...subject
      }))
    });
  });

  const updatedSubjects = await prisma.tutorSubject.findMany({
    where: { tutorId },
    include: { subject: true }
  });

  successResponse(res, { subjects: updatedSubjects }, 'Tutor subjects updated successfully');
}));

// POST /api/v1/tutors/:id/certifications - Add/update certifications
router.post('/:id/certifications', authenticateToken, requireRole('tutor'), asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const tutorId = req.params.id;
  const { certifications } = z.object({
    certifications: z.array(z.object({
      certificationId: z.string(),
      earnedDate: z.string().optional(),
      expiryDate: z.string().optional(),
      credentialUrl: z.string().url().optional()
    }))
  }).parse(req.body);

  // Verify tutor owns this profile
  const tutorProfile = await prisma.tutorProfile.findUnique({
    where: { id: tutorId, userId: user.id }
  });

  if (!tutorProfile) {
    throw new NotFoundError('Tutor profile not found or unauthorized');
  }

  // Update tutor certifications
  await prisma.$transaction(async (tx: any) => {
    // Delete existing certifications
    await tx.tutorCertification.deleteMany({
      where: { tutorId }
    });

    // Create new certifications
    await tx.tutorCertification.createMany({
      data: certifications.map(cert => ({
        tutorId,
        ...cert,
        earnedDate: cert.earnedDate ? new Date(cert.earnedDate) : undefined,
        expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : undefined
      }))
    });
  });

  const updatedCertifications = await prisma.tutorCertification.findMany({
    where: { tutorId },
    include: { certification: true }
  });

  successResponse(res, { certifications: updatedCertifications }, 'Tutor certifications updated successfully');
}));

export default router; 