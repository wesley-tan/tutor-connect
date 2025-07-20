import express, { Request, Response } from 'express';
import { prisma } from '@tutorconnect/database';
import { asyncHandler, successResponse, paginatedResponse, ValidationError, NotFoundError, ConflictError } from '../middleware/errorHandlers';
import { authenticateToken, AuthenticatedRequest } from '../utils/auth';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const BookSessionSchema = z.object({
  tutorId: z.string(),
  subjectId: z.string(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  sessionType: z.enum(['online', 'in_person']).default('online'),
  sessionNotes: z.string().optional()
});

const UpdateSessionSchema = z.object({
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  sessionNotes: z.string().optional(),
  homeworkAssigned: z.string().optional()
});

const SessionFilterSchema = z.object({
  status: z.string().optional(),
  tutorId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10)
});

// GET /api/v1/sessions - Get user's sessions
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const query = SessionFilterSchema.parse(req.query);
  const { page, limit, status, tutorId, startDate, endDate } = query;
  const offset = (page - 1) * limit;

  // Build where conditions based on user type
  const where: any = {
    OR: [
      { tutee: { userId: user.id } },
      { tutor: { userId: user.id } }
    ]
  };

  if (status) {
    where.status = status;
  }

  if (tutorId) {
    where.tutorId = tutorId;
  }

  if (startDate) {
    where.scheduledStart = { gte: new Date(startDate) };
  }

  if (endDate) {
    where.scheduledEnd = { lte: new Date(endDate) };
  }

  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      where,
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
        tutee: {
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
    prisma.session.count({ where })
  ]);

  paginatedResponse(res, sessions, total, page, limit, 'Sessions retrieved successfully');
}));

// POST /api/v1/sessions - Book a session
router.post('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const validatedData = BookSessionSchema.parse(req.body);

  // Verify user has a tutee profile
  const tuteeProfile = await prisma.tuteeProfile.findUnique({
    where: { userId: user.id }
  });

  if (!tuteeProfile) {
    throw new ValidationError('Only students/parents can book sessions');
  }

  // Verify tutor exists and is active
  const tutorProfile = await prisma.tutorProfile.findUnique({
    where: { id: validatedData.tutorId },
    include: { user: true }
  });

  if (!tutorProfile || !tutorProfile.user.isActive) {
    throw new NotFoundError('Tutor not found or inactive');
  }

  // Check for scheduling conflicts
  const scheduledStart = new Date(validatedData.scheduledStart);
  const scheduledEnd = new Date(validatedData.scheduledEnd);

  if (scheduledStart >= scheduledEnd) {
    throw new ValidationError('Session end time must be after start time');
  }

  if (scheduledStart <= new Date()) {
    throw new ValidationError('Cannot schedule sessions in the past');
  }

  // Check for conflicts with existing sessions
  const conflictingSessions = await prisma.session.findMany({
    where: {
      tutorId: validatedData.tutorId,
      status: { in: ['scheduled', 'in_progress'] },
      OR: [
        {
          AND: [
            { scheduledStart: { lte: scheduledStart } },
            { scheduledEnd: { gt: scheduledStart } }
          ]
        },
        {
          AND: [
            { scheduledStart: { lt: scheduledEnd } },
            { scheduledEnd: { gte: scheduledEnd } }
          ]
        }
      ]
    }
  });

  if (conflictingSessions.length > 0) {
    throw new ConflictError('Tutor is not available at the requested time');
  }

  // Check tutor availability
  const dayOfWeek = scheduledStart.getDay();
  const startTime = scheduledStart.toTimeString().slice(0, 5);
  const endTime = scheduledEnd.toTimeString().slice(0, 5);

  const availability = await prisma.tutorAvailability.findFirst({
    where: {
      tutorId: validatedData.tutorId,
      dayOfWeek,
      startTime: { lte: startTime },
      endTime: { gte: endTime },
      isAvailable: true
    }
  });

  if (!availability) {
    throw new ConflictError('Tutor is not available at the requested time');
  }

  // Create session
  const session = await prisma.session.create({
    data: {
      tuteeId: tuteeProfile.id,
      tutorId: validatedData.tutorId,
      subjectId: validatedData.subjectId,
      scheduledStart,
      scheduledEnd,
      sessionType: validatedData.sessionType,
      sessionNotes: validatedData.sessionNotes,
      pricePaid: tutorProfile.hourlyRate,
      platformFee: tutorProfile.hourlyRate * 0.15, // 15% platform fee
      tutorEarnings: tutorProfile.hourlyRate * 0.85
    },
    include: {
      tutor: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      },
      subject: { select: { name: true } }
    }
  });

  successResponse(res, { session }, 'Session booked successfully', 201);
}));

// GET /api/v1/sessions/:id - Get session details
router.get('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const sessionId = req.params.id;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      tutor: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              profileImageUrl: true,
              email: true
            }
          }
        }
      },
      tutee: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              profileImageUrl: true,
              email: true
            }
          }
        }
      },
      subject: { select: { name: true } },
      payment: {
        select: {
          id: true,
          amount: true,
          status: true,
          stripePaymentIntentId: true
        }
      },
      review: {
        select: {
          id: true,
          rating: true,
          reviewText: true,
          createdAt: true
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
    throw new ValidationError('You are not authorized to view this session');
  }

  successResponse(res, { session }, 'Session details retrieved successfully');
}));

// PUT /api/v1/sessions/:id - Update session
router.put('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const sessionId = req.params.id;
  const validatedData = UpdateSessionSchema.parse(req.body);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      tutor: { include: { user: true } },
      tutee: { include: { user: true } }
    }
  });

  if (!session) {
    throw new NotFoundError('Session not found');
  }

  // Verify user is part of this session
  const isParticipant = session.tutee.userId === user.id || session.tutor.userId === user.id;
  if (!isParticipant) {
    throw new ValidationError('You are not authorized to update this session');
  }

  // Only allow updates for scheduled sessions
  if (session.status !== 'scheduled') {
    throw new ValidationError('Can only update scheduled sessions');
  }

  // If rescheduling, check for conflicts
  if (validatedData.scheduledStart || validatedData.scheduledEnd) {
    const newStart = validatedData.scheduledStart ? new Date(validatedData.scheduledStart) : session.scheduledStart;
    const newEnd = validatedData.scheduledEnd ? new Date(validatedData.scheduledEnd) : session.scheduledEnd;

    if (newStart >= newEnd) {
      throw new ValidationError('Session end time must be after start time');
    }

    if (newStart <= new Date()) {
      throw new ValidationError('Cannot schedule sessions in the past');
    }

    // Check for conflicts
    const conflicts = await prisma.session.findMany({
      where: {
        id: { not: sessionId },
        tutorId: session.tutorId,
        status: { in: ['scheduled', 'in_progress'] },
        OR: [
          {
            AND: [
              { scheduledStart: { lte: newStart } },
              { scheduledEnd: { gt: newStart } }
            ]
          },
          {
            AND: [
              { scheduledStart: { lt: newEnd } },
              { scheduledEnd: { gte: newEnd } }
            ]
          }
        ]
      }
    });

    if (conflicts.length > 0) {
      throw new ConflictError('Tutor is not available at the new requested time');
    }
  }

  const updatedSession = await prisma.session.update({
    where: { id: sessionId },
    data: {
      ...(validatedData.scheduledStart && { scheduledStart: new Date(validatedData.scheduledStart) }),
      ...(validatedData.scheduledEnd && { scheduledEnd: new Date(validatedData.scheduledEnd) }),
      ...(validatedData.sessionNotes && { sessionNotes: validatedData.sessionNotes }),
      ...(validatedData.homeworkAssigned && { homeworkAssigned: validatedData.homeworkAssigned })
    },
    include: {
      tutor: {
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
    }
  });

  successResponse(res, { session: updatedSession }, 'Session updated successfully');
}));

// DELETE /api/v1/sessions/:id - Cancel session
router.delete('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const sessionId = req.params.id;
  const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      tutor: { include: { user: true } },
      tutee: { include: { user: true } },
      payment: true
    }
  });

  if (!session) {
    throw new NotFoundError('Session not found');
  }

  // Verify user is part of this session
  const isParticipant = session.tutee.userId === user.id || session.tutor.userId === user.id;
  if (!isParticipant) {
    throw new ValidationError('You are not authorized to cancel this session');
  }

  // Only allow cancellation of scheduled sessions
  if (session.status !== 'scheduled') {
    throw new ValidationError('Can only cancel scheduled sessions');
  }

  // Check cancellation timing (must be at least 24 hours before)
  const hoursUntilSession = (session.scheduledStart.getTime() - new Date().getTime()) / (1000 * 60 * 60);
  if (hoursUntilSession < 24) {
    throw new ValidationError('Sessions can only be cancelled at least 24 hours in advance');
  }

  // Cancel session
  const cancelledSession = await prisma.session.update({
    where: { id: sessionId },
    data: {
      status: 'cancelled',
      cancellationReason: reason || 'Cancelled by user'
    }
  });

  // If payment exists, initiate refund process
  if (session.payment && session.payment.status === 'succeeded') {
    // TODO: Implement refund logic with Stripe
  }

  successResponse(res, { session: cancelledSession }, 'Session cancelled successfully');
}));

// POST /api/v1/sessions/:id/join - Join video session
router.post('/:id/join', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const sessionId = req.params.id;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      tutor: { include: { user: true } },
      tutee: { include: { user: true } }
    }
  });

  if (!session) {
    throw new NotFoundError('Session not found');
  }

  // Verify user is part of this session
  const isParticipant = session.tutee.userId === user.id || session.tutor.userId === user.id;
  if (!isParticipant) {
    throw new ValidationError('You are not authorized to join this session');
  }

  // Check if session is ready to join (within 15 minutes of start time)
  const now = new Date();
  const sessionStart = new Date(session.scheduledStart);
  const minutesUntilStart = (sessionStart.getTime() - now.getTime()) / (1000 * 60);

  if (minutesUntilStart > 15) {
    throw new ValidationError('Session can only be joined 15 minutes before start time');
  }

  if (minutesUntilStart < -30) {
    throw new ValidationError('Session has ended');
  }

  // Update session status to in_progress if not already
  if (session.status === 'scheduled' && minutesUntilStart <= 0) {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'in_progress',
        actualStart: now
      }
    });
  }

  // Return session join information
  // TODO: Generate Zoom meeting URL or return video call token
  const joinInfo = {
    sessionId,
    meetingUrl: session.zoomJoinUrl || `https://tutorconnect.com/session/${sessionId}`,
    meetingId: session.zoomMeetingId || sessionId,
    password: session.zoomPassword
  };

  successResponse(res, { joinInfo }, 'Session join information retrieved successfully');
}));

// POST /api/v1/sessions/:id/complete - Mark session complete
router.post('/:id/complete', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const sessionId = req.params.id;
  const { sessionNotes, homeworkAssigned } = z.object({
    sessionNotes: z.string().optional(),
    homeworkAssigned: z.string().optional()
  }).parse(req.body);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      tutor: { include: { user: true } },
      tutee: { include: { user: true } }
    }
  });

  if (!session) {
    throw new NotFoundError('Session not found');
  }

  // Only tutors can mark sessions as complete
  if (session.tutor.userId !== user.id) {
    throw new ValidationError('Only the tutor can mark a session as complete');
  }

  // Can only complete in-progress sessions
  if (session.status !== 'in_progress') {
    throw new ValidationError('Can only complete sessions that are in progress');
  }

  const completedSession = await prisma.session.update({
    where: { id: sessionId },
    data: {
      status: 'completed',
      actualEnd: new Date(),
      sessionNotes,
      homeworkAssigned
    }
  });

  successResponse(res, { session: completedSession }, 'Session marked as completed successfully');
}));

export default router; 