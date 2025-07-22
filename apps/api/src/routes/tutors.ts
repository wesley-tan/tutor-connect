import express, { Request, Response } from 'express';
import { prisma, Prisma } from '@tutorconnect/database';
import { asyncHandler, successResponse } from '../middleware/errorHandlers';

const router = express.Router();

// Health check endpoint for basic connectivity testing
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, {
    status: 'ok',
    endpoint: 'tutors',
    timestamp: new Date().toISOString()
  }, 'Tutors endpoint is healthy');
}));

// GET /api/v1/tutors - Search for tutors (simplified)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Return demo data to make frontend work better
    const demoTutors = [
      {
        id: 'tutor-1',
        firstName: 'Dr. Sarah',
        lastName: 'Johnson',
        email: 'sarah.johnson@example.com',
        profileImageUrl: null,
        hourlyRate: 50,
        bio: 'Experienced mathematics and physics tutor with a PhD in Applied Mathematics.',
        subjects: ['Mathematics', 'Physics', 'Calculus'],
        rating: 4.8,
        totalSessions: 150,
        isOnline: true,
        availability: ['Monday evening', 'Wednesday evening', 'Saturday morning']
      },
      {
        id: 'tutor-2',
        firstName: 'Prof. Michael',
        lastName: 'Chen',
        email: 'michael.chen@example.com',
        profileImageUrl: null,
        hourlyRate: 45,
        bio: 'Chemistry professor with 10+ years of teaching experience.',
        subjects: ['Chemistry', 'Biology', 'Organic Chemistry'],
        rating: 4.9,
        totalSessions: 200,
        isOnline: true,
        availability: ['Tuesday afternoon', 'Thursday afternoon', 'Sunday morning']
      }
    ];
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    
    return successResponse(res, {
      data: demoTutors,
      pagination: {
        page,
        limit,
        total: demoTutors.length,
        totalPages: Math.ceil(demoTutors.length / limit)
      }
    }, 'Tutors retrieved successfully (demo mode)');
  } catch (error) {
    // logger.error('Error fetching tutors:', error); // logger is not defined in this file
    // Return empty array on error
    return successResponse(res, {
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0
      }
    }, 'No tutors found');
  }
}));

// GET /api/v1/tutors/:id - Get tutor profile (simplified)
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tutorId = req.params.id;

  if (!tutorId) {
    return res.status(400).json({
      success: false,
      message: 'Tutor ID is required'
    });
  }

  // Return demo tutor profile
  const demoTutor = {
    id: tutorId,
    firstName: 'Demo',
    lastName: 'Tutor',
    email: 'tutor@example.com',
    profileImageUrl: null,
    hourlyRate: 50,
    bio: 'Experienced tutor with expertise in multiple subjects.',
    ratingAverage: 4.8,
    totalReviews: 25,
    subjects: ['Mathematics', 'Physics', 'Chemistry'],
    availability: 'Available weekdays and weekends'
  };

  return successResponse(res, { tutor: demoTutor }, 'Tutor profile retrieved successfully (demo mode)');
}));

export default router; 