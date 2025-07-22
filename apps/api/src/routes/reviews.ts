import { Router, Request, Response } from 'express';
import { prisma } from '@tutorconnect/database';
import { asyncHandler, successResponse, ValidationError } from '../middleware/errorHandlers';
import { mockAuth, AuthenticatedRequest } from '../utils/supabaseAuth';
import { z } from 'zod';

const router = Router();

// Validation schemas
const CreateReviewSchema = z.object({
  sessionId: z.string(),
  rating: z.number().min(1).max(5),
  reviewText: z.string().nullable(),
  teachingEffectiveness: z.number().min(1).max(5).nullable(),
  communication: z.number().min(1).max(5).nullable(),
  punctuality: z.number().min(1).max(5).nullable(),
  wouldRecommend: z.boolean().nullable(),
  isAnonymous: z.boolean().default(false)
});

const UpdateReviewSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  reviewText: z.string().nullable().optional(),
  teachingEffectiveness: z.number().min(1).max(5).nullable().optional(),
  communication: z.number().min(1).max(5).nullable().optional(),
  punctuality: z.number().min(1).max(5).nullable().optional(),
  wouldRecommend: z.boolean().nullable().optional()
});

// GET /api/v1/reviews/session/:sessionId - Get review for a session
router.get('/session/:sessionId', mockAuth, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: 'Session ID is required'
    });
  }

  // Get session with review
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      review: true,
      tutor: {
        include: {
          user: true
        }
      },
      tutee: {
        include: {
          user: true
        }
      }
    }
  });

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }

  // Check if session is completed
  if (session.statusId !== 3) { // 3 = completed
    return res.status(400).json({
      success: false,
      message: 'Session must be completed before reviewing'
    });
  }

  // Check if user is participant
  const isParticipant = session.tutee.user.id === user.id || session.tutor.user.id === user.id;
  if (!isParticipant) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  if (!session.review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found'
    });
  }

  return successResponse(res, { review: session.review }, 'Review retrieved successfully');
}));

// POST /api/v1/reviews - Create a review
router.post('/', mockAuth, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const validatedData = CreateReviewSchema.parse(req.body);

  // Get session
  const session = await prisma.session.findUnique({
    where: { id: validatedData.sessionId },
    include: {
      tutor: {
        include: {
          user: true
        }
      },
      tutee: {
        include: {
          user: true
        }
      }
    }
  });

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }

  // Check if session is completed
  if (session.statusId !== 3) { // 3 = completed
    return res.status(400).json({
      success: false,
      message: 'Session must be completed before reviewing'
    });
  }

  // Check if user is participant
  const isParticipant = session.tutee.user.id === user.id || session.tutor.user.id === user.id;
  if (!isParticipant) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Check if review already exists
  const existingReview = await prisma.review.findUnique({
    where: { sessionId: validatedData.sessionId }
  });

  if (existingReview) {
    return res.status(400).json({
      success: false,
      message: 'Review already exists for this session'
    });
  }

  // Create review
  const review = await prisma.review.create({
    data: {
      reviewerId: user.id,
      revieweeId: session.tutor.user.id,
      sessionId: validatedData.sessionId,
      rating: validatedData.rating,
      reviewText: validatedData.reviewText,
      teachingEffectiveness: validatedData.teachingEffectiveness,
      communication: validatedData.communication,
      punctuality: validatedData.punctuality,
      wouldRecommend: validatedData.wouldRecommend,
      isAnonymous: validatedData.isAnonymous
    }
  });

  // Update tutor's rating
  await updateTutorRating(session.tutor.user.id);

  return successResponse(res, { review }, 'Review created successfully');
}));

// PUT /api/v1/reviews/:id - Update a review
router.put('/:id', mockAuth, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const { id: reviewId } = req.params;
  const validatedData = UpdateReviewSchema.parse(req.body);

  if (!reviewId) {
    return res.status(400).json({
      success: false,
      message: 'Review ID is required'
    });
  }

  // Get review
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      session: {
        include: {
          tutor: {
            include: {
              user: true
            }
          }
        }
      }
    }
  });

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found'
    });
  }

  // Check if user is reviewer
  if (review.reviewerId !== user.id) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Update review
  const updateData: any = {};
  if (validatedData.rating !== undefined) updateData.rating = validatedData.rating;
  if (validatedData.reviewText !== undefined) updateData.reviewText = validatedData.reviewText;
  if (validatedData.teachingEffectiveness !== undefined) updateData.teachingEffectiveness = validatedData.teachingEffectiveness;
  if (validatedData.communication !== undefined) updateData.communication = validatedData.communication;
  if (validatedData.punctuality !== undefined) updateData.punctuality = validatedData.punctuality;
  if (validatedData.wouldRecommend !== undefined) updateData.wouldRecommend = validatedData.wouldRecommend;

  const updatedReview = await prisma.review.update({
    where: { id: reviewId },
    data: updateData
  });

  // Update tutor's rating
  await updateTutorRating(review.session.tutor.user.id);

  return successResponse(res, { review: updatedReview }, 'Review updated successfully');
}));

// DELETE /api/v1/reviews/:id - Delete a review
router.delete('/:id', mockAuth, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const { id: reviewId } = req.params;

  if (!reviewId) {
    return res.status(400).json({
      success: false,
      message: 'Review ID is required'
    });
  }

  // Get review
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      session: {
        include: {
          tutor: {
            include: {
              user: true
            }
          }
        }
      }
    }
  });

  if (!review) {
    return res.status(404).json({
      success: false,
      message: 'Review not found'
    });
  }

  // Check if user is reviewer
  if (review.reviewerId !== user.id) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Delete review
  await prisma.review.delete({
    where: { id: reviewId }
  });

  // Update tutor's rating
  await updateTutorRating(review.session.tutor.user.id);

  return successResponse(res, null, 'Review deleted successfully');
}));

// Helper function to update tutor's rating
async function updateTutorRating(tutorId: string) {
  // Get tutor's reviews
  const reviews = await prisma.review.findMany({
    where: {
      revieweeId: tutorId
    }
  });

  // Calculate average rating
  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

  // Update tutor profile
  await prisma.tutorProfile.update({
    where: { userId: tutorId },
    data: {
      ratingAverage: averageRating,
      totalReviews: reviews.length
    }
  });
}

export default router; 