import { Router, Response } from 'express';
import { prisma } from '@tutorconnect/database';
import { AuthenticatedRequest, mockAuth } from '../utils/supabaseAuth';
import { asyncHandler, successResponse } from '../middleware/errorHandlers';
import { z } from 'zod';
import { SessionService } from '../services/SessionService';
import { logger } from '../utils/logger';

const router = Router();
const sessionService = new SessionService(prisma);

// Validation schemas
const CreateSessionSchema = z.object({
  tutorId: z.string(),
  subjectId: z.string(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  sessionType: z.enum(['online', 'in_person']).default('online'),
  notes: z.string().optional()
});

const UpdateSessionSchema = z.object({
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  actualStart: z.string().datetime().optional(),
  actualEnd: z.string().datetime().optional(),
  sessionType: z.enum(['online', 'in_person']).optional(),
  sessionNotes: z.string().optional(),
  homeworkAssigned: z.string().optional(),
  cancellationReason: z.string().optional(),
  statusId: z.number().optional()
}).strict();

// GET /api/v1/sessions - Get user's sessions
router.get('/', mockAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    
    // Return demo data to make frontend work better
    const demoSessions = [
      {
        id: 'session-1',
        scheduledStart: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        scheduledEnd: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
        actualStart: null,
        actualEnd: null,
        sessionType: 'online',
        sessionNotes: 'Math tutoring session - Algebra basics',
        homeworkAssigned: null,
        status: {
          id: 2,
          name: 'Confirmed'
        },
        tutor: {
          user: {
            id: 'tutor-1',
            firstName: 'Dr. Sarah',
            lastName: 'Johnson',
            email: 'sarah.johnson@example.com',
            profileImageUrl: null
          }
        },
        tutee: {
          user: {
            id: user.id,
            firstName: user.firstName || 'John',
            lastName: user.lastName || 'Doe',
            email: user.email,
            profileImageUrl: null
          }
        },
        subject: {
          id: 'math-1',
          name: 'Mathematics'
        }
      },
      {
        id: 'session-2',
        scheduledStart: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // Day after tomorrow
        scheduledEnd: new Date(Date.now() + 49 * 60 * 60 * 1000).toISOString(),
        actualStart: null,
        actualEnd: null,
        sessionType: 'in_person',
        sessionNotes: 'Science tutoring - Chemistry lab prep',
        homeworkAssigned: 'Complete lab safety worksheet',
        status: {
          id: 1,
          name: 'Pending'
        },
        tutor: {
          user: {
            id: 'tutor-2',
            firstName: 'Prof. Michael',
            lastName: 'Chen',
            email: 'michael.chen@example.com',
            profileImageUrl: null
          }
        },
        tutee: {
          user: {
            id: user.id,
            firstName: user.firstName || 'John',
            lastName: user.lastName || 'Doe',
            email: user.email,
            profileImageUrl: null
          }
        },
        subject: {
          id: 'science-1',
          name: 'Chemistry'
        }
      }
    ];
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    
    return successResponse(res, {
      success: true,
      data: demoSessions,
      pagination: {
        page,
        limit,
        total: demoSessions.length,
        totalPages: Math.ceil(demoSessions.length / limit)
      }
    }, 'Sessions retrieved successfully (demo mode)');
  } catch (error) {
    logger.error('Error in GET /sessions:', error);
    return successResponse(res, {
      success: false,
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
      },
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, 'Error retrieving sessions');
  }
}));

// POST /api/v1/sessions - Create new session
router.post('/', mockAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Simplified creation response
  successResponse(res, {
    id: 'demo-session-1',
    message: 'Session creation not implemented in demo mode'
  }, 'Session creation noted (demo mode)', 201);
}));

// PUT /api/v1/sessions/:id - Update session
router.put('/:id', mockAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const sessionId = req.params.id;
  
  successResponse(res, {
    id: sessionId,
    message: 'Session update not implemented in demo mode'
  }, 'Session update noted (demo mode)');
}));

// DELETE /api/v1/sessions/:id - Cancel session
router.delete('/:id', mockAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const sessionId = req.params.id;
  
  successResponse(res, {
    id: sessionId,
    message: 'Session cancellation not implemented in demo mode'
  }, 'Session cancellation noted (demo mode)');
}));

export default router; 