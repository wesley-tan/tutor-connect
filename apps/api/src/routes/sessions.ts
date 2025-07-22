import { Router, Response } from 'express';
import { prisma } from '@tutorconnect/database';
import { AuthenticatedRequest, authenticateToken } from '../utils/supabaseAuth';
import { asyncHandler, successResponse } from '../middleware/errorHandlers';
import { z } from 'zod';
import { SessionService } from '../services/SessionService';
import { logger } from '../utils/logger';
import type { Prisma, Session } from '@prisma/client';

const router = Router();
const sessionService = new SessionService(prisma);

// Validation schemas
const CreateSessionSchema = z.object({
  tutorId: z.string(),
  subjectId: z.string(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  sessionType: z.enum(['online', 'in_person']).default('online'),
  notes: z.string().optional().nullable()
});

const UpdateSessionSchema = z.object({
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  actualStart: z.string().datetime().optional(),
  actualEnd: z.string().datetime().optional(),
  sessionType: z.enum(['online', 'in_person']).optional(),
  sessionNotes: z.string().optional().nullable(),
  homeworkAssigned: z.string().optional().nullable(),
  cancellationReason: z.string().optional().nullable(),
  statusId: z.number().optional()
}).strict();

// GET /api/v1/sessions - Get user's sessions
router.get('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    // Get total count
    const total = await prisma.session.count({
      where: {
        OR: [
          { tuteeId: user.id },
          { tutorId: user.id }
        ]
      }
    });

    // Get sessions
    const sessions = await prisma.session.findMany({
      where: {
        OR: [
          { tuteeId: user.id },
          { tutorId: user.id }
        ]
      },
      include: {
        tutor: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                profileImageUrl: true
              }
            }
          }
        },
        tutee: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                profileImageUrl: true
              }
            }
          }
        },
        subject: true,
        status: true
      },
      orderBy: {
        scheduledStart: 'desc'
      },
      skip,
      take: limit
    });

    return successResponse(res, {
      data: sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, 'Sessions retrieved successfully');
  } catch (error) {
    logger.error('Error in GET /sessions:', error);
    throw error;
  }
}));

// POST /api/v1/sessions - Create new session
router.post('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { user } = req;
  const data = CreateSessionSchema.parse(req.body);

  // Check for scheduling conflicts
  const existingSession = await prisma.session.findUnique({
    where: {
      unique_tutor_timeslot: {
        tutorId: data.tutorId,
        scheduledStart: new Date(data.scheduledStart)
      }
    }
  });

  if (existingSession) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'SCHEDULING_CONFLICT',
        message: 'The tutor is already booked for this time slot'
      }
    });
  }

  const createData: Prisma.SessionCreateInput = {
    tutee: { connect: { id: user.id } },
    tutor: { connect: { id: data.tutorId } },
    subject: { connect: { id: data.subjectId } },
    scheduledStart: new Date(data.scheduledStart),
    scheduledEnd: new Date(data.scheduledEnd),
    sessionType: data.sessionType,
    sessionNotes: data.notes ?? null,
    status: { connect: { id: 1 } } // Pending status
  };

  const session = await prisma.session.create({
    data: createData,
    include: {
      tutor: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profileImageUrl: true
            }
          }
        }
      },
      tutee: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profileImageUrl: true
            }
          }
        }
      },
      subject: true,
      status: true
    }
  });

  return successResponse(res, session, 'Session created successfully', 201);
}));

// PUT /api/v1/sessions/:id - Update session
router.put('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { user } = req;
  const sessionId = req.params.id;
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Session ID is required'
      }
    });
  }

  const data = UpdateSessionSchema.parse(req.body);

  // Verify user is part of this session
  const [existingSession] = await prisma.$queryRaw<Session[]>`
    SELECT * FROM sessions
    WHERE id = ${sessionId}
    AND (tutee_id = ${user.id} OR tutor_id = ${user.id})
    LIMIT 1
  `;

  if (!existingSession) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Session not found'
      }
    });
  }

  // If updating scheduledStart, check for conflicts
  if (data.scheduledStart) {
    const [conflict] = await prisma.$queryRaw<Session[]>`
      SELECT * FROM sessions
      WHERE tutor_id = ${existingSession.tutorId}
      AND scheduled_start = ${new Date(data.scheduledStart)}
      AND id != ${sessionId}
      LIMIT 1
    `;

    if (conflict) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'SCHEDULING_CONFLICT',
          message: 'The tutor is already booked for this time slot'
        }
      });
    }
  }

  const updateData: Prisma.SessionUpdateInput = {
    ...(data.scheduledStart && { scheduledStart: new Date(data.scheduledStart) }),
    ...(data.scheduledEnd && { scheduledEnd: new Date(data.scheduledEnd) }),
    ...(data.actualStart && { actualStart: new Date(data.actualStart) }),
    ...(data.actualEnd && { actualEnd: new Date(data.actualEnd) }),
    ...(data.sessionType && { sessionType: data.sessionType }),
    sessionNotes: data.sessionNotes ?? null,
    homeworkAssigned: data.homeworkAssigned ?? null,
    cancellationReason: data.cancellationReason ?? null,
    ...(data.statusId && { status: { connect: { id: data.statusId } } })
  };

  const session = await prisma.session.update({
    where: { id: sessionId },
    data: updateData,
    include: {
      tutor: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profileImageUrl: true
            }
          }
        }
      },
      tutee: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profileImageUrl: true
            }
          }
        }
      },
      subject: true,
      status: true
    }
  });

  return successResponse(res, session, 'Session updated successfully');
}));

// DELETE /api/v1/sessions/:id - Cancel session
router.delete('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { user } = req;
  const sessionId = req.params.id;

  // Verify user is part of this session
  const existingSession = await prisma.session.findFirst({
    where: {
      id: sessionId as string,
      OR: [
        { tuteeId: user.id },
        { tutorId: user.id }
      ]
    }
  });

  if (!existingSession) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }

  // Soft delete by updating status to cancelled
  const session = await prisma.session.update({
    where: { id: sessionId } as Prisma.SessionWhereUniqueInput,
    data: {
      status: { connect: { id: 4 } }, // Cancelled status
      cancellationReason: req.body.reason || 'Cancelled by user'
    }
  });

  return successResponse(res, session, 'Session cancelled successfully');
}));

export default router; 