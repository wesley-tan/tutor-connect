import express, { Request, Response } from 'express';
import { prisma } from '@tutorconnect/database';
import { asyncHandler, successResponse, paginatedResponse, ValidationError, NotFoundError, ConflictError } from '../middleware/errorHandlers';
import { authenticateSupabaseToken, AuthenticatedRequest } from '../utils/supabaseAuth';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const CreateReviewSchema = z.object({
  sessionId: z.string(),
  rating: z.number().min(1).max(5),
  reviewText: z.string().min(10).max(1000),
  tags: z.array(z.string()).optional()
});

const UpdateReviewSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  reviewText: z.string().min(10).max(1000).optional(),
  tags: z.array(z.string()).optional()
});

const ReviewFilterSchema = z.object({
  tutorId: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10)
});

// POST /api/v1/reviews - Submit review
router.post('/', authenticateSupabaseToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const { sessionId, rating, reviewText, tags } = CreateReviewSchema.parse(req.body);

  // Get session details
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      tutee: { include: { user: true } },
      tutor: { include: { user: true } },
      review: true
    }
  });

  if (!session) {
    throw new NotFoundError('Session not found');
  }

  // Verify user is the tutee for this session
  if (session.tutee.userId !== user.id) {
    throw new ValidationError('Only the student can review this session');
  }

  // Session must be completed to be reviewed
  if (session.status !== 'completed') {
    throw new ValidationError('Can only review completed sessions');
  }

  // Check if review already exists
  if (session.review) {
    throw new ConflictError('Review already exists for this session');
  }

  // Create review
  const review = await prisma.review.create({
    data: {
      sessionId,
      reviewerId: user.id,
      revieweeId: session.tutor.userId,
      rating,
      reviewText,
      tags: tags || []
    },
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
          subject: { select: { name: true } }
        }
      }
    }
  });

  // Update tutor's rating average and review count
  await updateTutorRating(session.tutorId);

  successResponse(res, { review }, 'Review submitted successfully', 201);
}));

// GET /api/v1/reviews/:sessionId - Get session review
router.get('/:sessionId', authenticateSupabaseToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const sessionId = req.params.sessionId;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      tutee: { include: { user: true } },
      tutor: { include: { user: true } },
      review: {
        include: {
          reviewer: {
            select: {
              firstName: true,
              lastName: true,
              profileImageUrl: true
            }
          }
        }
      }
    }
  });

  if (!session) {
    throw new NotFoundError('Session not found');
  }

  // Verify user is part of this session
  const isParticipant = session.tutee.userId === user.id || session.tutor.userId === user.id;
  if (!isParticipant) {
    throw new ValidationError('You are not authorized to view this review');
  }

  if (!session.review) {
    return successResponse(res, { review: null }, 'No review found for this session');
  }

  successResponse(res, { review: session.review }, 'Review retrieved successfully');
}));

// PUT /api/v1/reviews/:id - Update review
router.put('/:id', authenticateSupabaseToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const reviewId = req.params.id;
  const validatedData = UpdateReviewSchema.parse(req.body);

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      session: {
        include: {
          tutor: true
        }
      }
    }
  });

  if (!review) {
    throw new NotFoundError('Review not found');
  }

  // Verify user is the reviewer
  if (review.reviewerId !== user.id) {
    throw new ValidationError('You can only update your own reviews');
  }

  // Check if review is within edit window (e.g., 7 days)
  const daysSinceReview = (new Date().getTime() - review.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceReview > 7) {
    throw new ValidationError('Reviews can only be edited within 7 days of submission');
  }

  const updatedReview = await prisma.review.update({
    where: { id: reviewId },
    data: validatedData,
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
          subject: { select: { name: true } }
        }
      }
    }
  });

  // Update tutor's rating average if rating changed
  if (validatedData.rating) {
    await updateTutorRating(review.session.tutorId);
  }

  successResponse(res, { review: updatedReview }, 'Review updated successfully');
}));

// GET /api/v1/reviews - Get reviews (with filtering)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { tutorId, rating, page, limit } = ReviewFilterSchema.parse(req.query);
  const offset = (page - 1) * limit;

  // Build where conditions
  const where: any = {};

  if (tutorId) {
    where.session = { tutorId };
  }

  if (rating) {
    where.rating = rating;
  }

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
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
            subject: { select: { name: true } },
            tutor: {
              select: {
                id: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        }
      },
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.review.count({ where })
  ]);

  paginatedResponse(res, reviews, total, page, limit, 'Reviews retrieved successfully');
}));

// DELETE /api/v1/reviews/:id - Delete review
router.delete('/:id', authenticateSupabaseToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const reviewId = req.params.id;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      session: {
        include: {
          tutor: true
        }
      }
    }
  });

  if (!review) {
    throw new NotFoundError('Review not found');
  }

  // Verify user is the reviewer
  if (review.reviewerId !== user.id) {
    throw new ValidationError('You can only delete your own reviews');
  }

  // Check if review is within deletion window (e.g., 24 hours)
  const hoursSinceReview = (new Date().getTime() - review.createdAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceReview > 24) {
    throw new ValidationError('Reviews can only be deleted within 24 hours of submission');
  }

  await prisma.review.delete({
    where: { id: reviewId }
  });

  // Update tutor's rating average
  await updateTutorRating(review.session.tutorId);

  successResponse(res, null, 'Review deleted successfully');
}));

// GET /api/v1/reviews/statistics/:tutorId - Get review statistics for a tutor
router.get('/statistics/:tutorId', asyncHandler(async (req: Request, res: Response) => {
  const tutorId = req.params.tutorId;

  // Verify tutor exists
  const tutor = await prisma.tutorProfile.findUnique({
    where: { id: tutorId }
  });

  if (!tutor) {
    throw new NotFoundError('Tutor not found');
  }

  // Get review statistics
  const [
    ratingDistribution,
    averageRating,
    totalReviews,
    recentReviews
  ] = await Promise.all([
    // Rating distribution (1-5 stars)
    prisma.review.groupBy({
      by: ['rating'],
      where: { session: { tutorId } },
      _count: { rating: true }
    }),
    // Average rating
    prisma.review.aggregate({
      where: { session: { tutorId } },
      _avg: { rating: true }
    }),
    // Total reviews
    prisma.review.count({
      where: { session: { tutorId } }
    }),
    // Recent reviews (last 5)
    prisma.review.findMany({
      where: { session: { tutorId } },
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
            subject: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    })
  ]);

  // Format rating distribution
  const distributionMap = new Map(ratingDistribution.map(r => [r.rating, r._count.rating]));
  const formattedDistribution = [1, 2, 3, 4, 5].map(rating => ({
    rating,
    count: distributionMap.get(rating) || 0
  }));

  const statistics = {
    averageRating: averageRating._avg.rating || 0,
    totalReviews,
    ratingDistribution: formattedDistribution,
    recentReviews
  };

  successResponse(res, { statistics }, 'Review statistics retrieved successfully');
}));

// Helper function to update tutor rating
async function updateTutorRating(tutorId: string) {
  const ratingStats = await prisma.review.aggregate({
    where: { session: { tutorId } },
    _avg: { rating: true },
    _count: { rating: true }
  });

  await prisma.tutorProfile.update({
    where: { id: tutorId },
    data: {
      ratingAverage: ratingStats._avg.rating || 0,
      totalReviews: ratingStats._count.rating || 0
    }
  });
}

export default router; 