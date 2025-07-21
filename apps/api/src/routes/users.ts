import express, { Request, Response } from 'express';
import { prisma } from '@tutorconnect/database';
import { asyncHandler, successResponse, ValidationError, NotFoundError } from '../middleware/errorHandlers';
import { authenticateSupabaseToken, AuthenticatedRequest } from '../utils/supabaseAuth';
import { z } from 'zod';
import multer from 'multer';

const router = express.Router();

// Multer configuration for file uploads
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Validation schemas
const UpdateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  timezone: z.string().optional(),
  profileImageUrl: z.string().url().optional()
});

const CreateTuteeProfileSchema = z.object({
  gradeLevel: z.string().optional(),
  schoolName: z.string().optional(),
  learningStyle: z.enum(['visual', 'auditory', 'kinesthetic', 'mixed']).optional(),
  budgetMin: z.number().min(0).optional(),
  budgetMax: z.number().min(0).optional(),
  preferredSessionLength: z.number().min(30).max(180).default(60),
  locationCity: z.string().optional(),
  locationState: z.string().optional(),
  parentId: z.string().optional()
});

const CreateTutorProfileSchema = z.object({
  hourlyRate: z.number().min(10).max(500),
  educationLevel: z.string().optional(),
  university: z.string().optional(),
  major: z.string().optional(),
  graduationYear: z.number().optional(),
  teachingExperienceYears: z.number().min(0).default(0),
  bio: z.string().max(1000).optional(),
  teachingMethodology: z.string().max(500).optional(),
  availabilityTimezone: z.string().default('UTC')
});

// GET /api/v1/users/profile - Get current user profile
router.get('/profile', authenticateSupabaseToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  
  const userProfile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      userType: true,
      phone: true,
      profileImageUrl: true,
      timezone: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
      tuteeProfile: {
        include: {
          tuteeSubjectNeeds: {
            include: { subject: true }
          },
          tuteeLearningGoals: true
        }
      },
      tutorProfile: {
        include: {
          tutorSubjects: {
            include: { subject: true }
          },
          tutorCertifications: {
            include: { certification: true }
          },
          tutorSpecializations: true,
          tutorLanguages: true
        }
      }
    }
  });

  if (!userProfile) {
    throw new NotFoundError('User profile not found');
  }

  successResponse(res, { user: userProfile }, 'User profile retrieved successfully');
}));

// PUT /api/v1/users/profile - Update current user profile
router.put('/profile', authenticateSupabaseToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const validatedData = UpdateProfileSchema.parse(req.body);
  
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: validatedData,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      userType: true,
      phone: true,
      profileImageUrl: true,
      timezone: true,
      isVerified: true,
      updatedAt: true
    }
  });

  successResponse(res, { user: updatedUser }, 'Profile updated successfully');
}));

// POST /api/v1/users/upload-avatar - Upload profile avatar
router.post('/upload-avatar', authenticateSupabaseToken, upload.single('avatar'), asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  
  if (!req.file) {
    throw new ValidationError('Avatar image is required');
  }

  // TODO: Upload to cloud storage (AWS S3, Cloudinary, etc.)
  // For now, we'll simulate the upload and return a placeholder URL
  const avatarUrl = `https://tutorconnect-avatars.s3.amazonaws.com/${user.id}/${req.file.filename}`;
  
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { profileImageUrl: avatarUrl },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profileImageUrl: true
    }
  });

  successResponse(res, { user: updatedUser }, 'Avatar uploaded successfully');
}));

// DELETE /api/v1/users/account - Delete user account
router.delete('/account', authenticateSupabaseToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const { confirmPassword } = z.object({
    confirmPassword: z.string()
  }).parse(req.body);

  // Get user with password hash to verify
  const userWithPassword = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true }
  });

  if (!userWithPassword) {
    throw new NotFoundError('User not found');
  }

  // Verify password before deletion
  const bcrypt = await import('bcryptjs');
  const isValidPassword = await bcrypt.compare(confirmPassword, userWithPassword.passwordHash);
  if (!isValidPassword) {
    throw new ValidationError('Invalid password');
  }

  // Soft delete user by deactivating account
  await prisma.user.update({
    where: { id: user.id },
    data: { 
      isActive: false,
      email: `deleted_${Date.now()}_${user.id}@deleted.com` // Prevent email conflicts
    }
  });

  successResponse(res, null, 'Account deleted successfully');
}));

// POST /api/v1/users/tutee-profile - Create tutee profile
router.post('/tutee-profile', authenticateSupabaseToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const validatedData = CreateTuteeProfileSchema.parse(req.body);

  // Check if user is student (includes both former students and parents)
  if (user.userType !== 'student') {
    throw new ValidationError('Only students can create tutee profiles');
  }

  // Check if profile already exists
  const existingProfile = await prisma.tuteeProfile.findUnique({
    where: { userId: user.id }
  });

  if (existingProfile) {
    throw new ValidationError('Tutee profile already exists');
  }

  const tuteeProfile = await prisma.tuteeProfile.create({
    data: {
      userId: user.id,
      ...validatedData
    },
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

  successResponse(res, { profile: tuteeProfile }, 'Tutee profile created successfully', 201);
}));

// POST /api/v1/users/tutor-profile - Create tutor profile
router.post('/tutor-profile', authenticateSupabaseToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const validatedData = CreateTutorProfileSchema.parse(req.body);

  // Check if user is tutor
  if (user.userType !== 'tutor') {
    throw new ValidationError('Only tutors can create tutor profiles');
  }

  // Check if profile already exists
  const existingProfile = await prisma.tutorProfile.findUnique({
    where: { userId: user.id }
  });

  if (existingProfile) {
    throw new ValidationError('Tutor profile already exists');
  }

  const tutorProfile = await prisma.tutorProfile.create({
    data: {
      userId: user.id,
      ...validatedData
    },
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

  successResponse(res, { profile: tutorProfile }, 'Tutor profile created successfully', 201);
}));

// GET /api/v1/users/tutee/recommendations - Get tutor recommendations (for tutees)
router.get('/tutee/recommendations', authenticateSupabaseToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  
  // Get tutee profile with subject needs
  const tuteeProfile = await prisma.tuteeProfile.findUnique({
    where: { userId: user.id },
    include: {
      tuteeSubjectNeeds: {
        include: { subject: true }
      }
    }
  });

  if (!tuteeProfile) {
    throw new ValidationError('Tutee profile not found');
  }

  // Get recommended tutors based on subject needs and budget
  const subjectIds = tuteeProfile.tuteeSubjectNeeds.map(need => need.subjectId);
  
  const recommendedTutors = await prisma.tutorProfile.findMany({
    where: {
      user: { isActive: true },
      isVerified: true,
      ...(tuteeProfile.budgetMax && { hourlyRate: { lte: tuteeProfile.budgetMax } }),
      tutorSubjects: {
        some: {
          subjectId: { in: subjectIds }
        }
      }
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          profileImageUrl: true
        }
      },
      tutorSubjects: {
        where: { subjectId: { in: subjectIds } },
        include: { subject: true }
      }
    },
    orderBy: [
      { ratingAverage: 'desc' },
      { totalReviews: 'desc' }
    ],
    take: 10
  });

  successResponse(res, { tutors: recommendedTutors }, 'Tutor recommendations retrieved successfully');
}));

// POST /api/v1/users/tutee/search - Search tutors with filters (for tutees)
router.post('/tutee/search', authenticateSupabaseToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  
  const {
    subjects,
    minRating,
    maxHourlyRate,
    availability,
    location,
    page = 1,
    limit = 10
  } = z.object({
    subjects: z.array(z.string()).optional(),
    minRating: z.number().min(0).max(5).optional(),
    maxHourlyRate: z.number().min(0).optional(),
    availability: z.object({
      dayOfWeek: z.number().min(0).max(6),
      startTime: z.string(),
      endTime: z.string()
    }).optional(),
    location: z.object({
      city: z.string(),
      state: z.string()
    }).optional(),
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(50).default(10)
  }).parse(req.body);

  const offset = (page - 1) * limit;

  // Build search criteria
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

  if (subjects && subjects.length > 0) {
    where.tutorSubjects = {
      some: {
        subject: {
          name: { in: subjects }
        }
      }
    };
  }

  if (availability) {
    where.tutorAvailability = {
      some: {
        dayOfWeek: availability.dayOfWeek,
        startTime: { lte: availability.startTime },
        endTime: { gte: availability.endTime },
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
            firstName: true,
            lastName: true,
            profileImageUrl: true
          }
        },
        tutorSubjects: {
          include: { subject: true }
        },
        tutorCertifications: {
          include: { certification: true }
        }
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

  successResponse(res, { 
    tutors, 
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }, 'Tutor search results retrieved successfully');
}));

// GET /api/v1/users/tutee/sessions - Get tutee's session history
router.get('/tutee/sessions', authenticateSupabaseToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const offset = (page - 1) * limit;

  const tuteeProfile = await prisma.tuteeProfile.findUnique({
    where: { userId: user.id }
  });

  if (!tuteeProfile) {
    throw new ValidationError('Tutee profile not found');
  }

  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      where: { tuteeId: tuteeProfile.id },
      include: {
        tutor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                profileImageUrl: true
              }
            }
          }
        },
        subject: { select: { name: true } },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true
          }
        }
      },
      skip: offset,
      take: limit,
      orderBy: { scheduledStart: 'desc' }
    }),
    prisma.session.count({
      where: { tuteeId: tuteeProfile.id }
    })
  ]);

  successResponse(res, { 
    sessions, 
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }, 'Session history retrieved successfully');
}));

// POST /api/v1/users/tutee/goals - Add/update learning goals
router.post('/tutee/goals', authenticateSupabaseToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const { goals } = z.object({
    goals: z.array(z.object({
      goalText: z.string().min(1).max(500),
      priority: z.number().min(1).max(5).default(1)
    }))
  }).parse(req.body);

  const tuteeProfile = await prisma.tuteeProfile.findUnique({
    where: { userId: user.id }
  });

  if (!tuteeProfile) {
    throw new ValidationError('Tutee profile not found');
  }

  // Delete existing goals and create new ones
  await prisma.$transaction(async (tx: any) => {
    await tx.tuteeLearningGoal.deleteMany({
      where: { tuteeId: tuteeProfile.id }
    });

    await tx.tuteeLearningGoal.createMany({
      data: goals.map(goal => ({
        tuteeId: tuteeProfile.id,
        ...goal
      }))
    });
  });

  const updatedGoals = await prisma.tuteeLearningGoal.findMany({
    where: { tuteeId: tuteeProfile.id },
    orderBy: { priority: 'desc' }
  });

  successResponse(res, { goals: updatedGoals }, 'Learning goals updated successfully');
}));

// POST /api/v1/users/tutee/subjects - Add/update subject needs
router.post('/tutee/subjects', authenticateSupabaseToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const { subjects } = z.object({
    subjects: z.array(z.object({
      subjectId: z.string(),
      urgencyLevel: z.number().min(1).max(5).default(1)
    }))
  }).parse(req.body);

  const tuteeProfile = await prisma.tuteeProfile.findUnique({
    where: { userId: user.id }
  });

  if (!tuteeProfile) {
    throw new ValidationError('Tutee profile not found');
  }

  // Delete existing subjects and create new ones
  await prisma.$transaction(async (tx: any) => {
    await tx.tuteeSubjectNeed.deleteMany({
      where: { tuteeId: tuteeProfile.id }
    });

    await tx.tuteeSubjectNeed.createMany({
      data: subjects.map(subject => ({
        tuteeId: tuteeProfile.id,
        ...subject
      }))
    });
  });

  const updatedSubjects = await prisma.tuteeSubjectNeed.findMany({
    where: { tuteeId: tuteeProfile.id },
    include: { subject: true },
    orderBy: { urgencyLevel: 'desc' }
  });

  successResponse(res, { subjects: updatedSubjects }, 'Subject needs updated successfully');
}));

export default router; 