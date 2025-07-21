import { Router } from 'express';
import { prisma } from '@tutorconnect/database';
import { logger } from '../utils/logger';
import { verifySupabaseToken, AuthenticatedRequest } from '../utils/supabaseAuth';

const router = Router();

// Get all sessions for the authenticated user
router.get('/', verifySupabaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user.id;
    const { status, role } = req.query;

    let whereClause: any = {
    OR: [
        { tutee: { userId } },
        { tutor: { userId } }
    ]
  };

    // Filter by status if provided
  if (status) {
      whereClause.statusId = parseInt(status as string);
  }

    const sessions = await prisma.session.findMany({
      where: whereClause,
      include: {
        subject: true,
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
        }
      },
      orderBy: {
        scheduledStart: 'desc'
      }
    });

    // Transform sessions to show the other participant
    const transformedSessions = sessions.map(session => {
      const isTutor = session.tutor.userId === userId;
      const otherParticipant = isTutor ? session.tutee.user : session.tutor.user;
      
      return {
        ...session,
        otherParticipant,
        role: isTutor ? 'tutor' : 'tutee'
      };
    });

    res.json({
      success: true,
      data: transformedSessions
    });
  } catch (error) {
    logger.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sessions'
    });
  }
});

// Get a specific session
router.get('/:sessionId', verifySupabaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        OR: [
          { tutee: { userId } },
          { tutor: { userId } }
        ]
      },
      include: {
        subject: true,
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
        }
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    logger.error('Error fetching session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch session'
    });
  }
});

// Create a new session (booking)
router.post('/', verifySupabaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      tutorId,
      subjectId,
      scheduledStart,
      scheduledEnd,
      sessionType,
      location,
      notes
    } = req.body;
    const tuteeId = req.user.id;

    // Validate required fields
    if (!tutorId || !subjectId || !scheduledStart || !scheduledEnd) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Verify the user is a student/tutee
    const user = await prisma.user.findUnique({
      where: { id: tuteeId }
    });

    if (user?.userType !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can book sessions'
      });
    }

    // Get the tutee profile
  const tuteeProfile = await prisma.tuteeProfile.findUnique({
      where: { userId: tuteeId }
  });

  if (!tuteeProfile) {
      return res.status(404).json({
        success: false,
        message: 'Tutee profile not found'
      });
  }

    // Verify the tutor exists and is approved
    const tutor = await prisma.tutorProfile.findFirst({
      where: {
        userId: tutorId,
        isVerified: true
      }
  });

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: 'Tutor not found or not verified'
      });
  }

  // Check for scheduling conflicts
    const conflictingSession = await prisma.session.findFirst({
    where: {
        tutorId: tutor.id,
        statusId: { in: [1, 2, 3] }, // Pending, Confirmed, In Progress
      OR: [
        {
            scheduledStart: { lte: new Date(scheduledStart) },
            scheduledEnd: { gt: new Date(scheduledStart) }
        },
        {
            scheduledStart: { lt: new Date(scheduledEnd) },
            scheduledEnd: { gte: new Date(scheduledEnd) }
        }
      ]
    }
  });

    if (conflictingSession) {
      return res.status(409).json({
        success: false,
        message: 'Tutor is not available at this time'
      });
  }

    // Calculate session duration and price
    const startTime = new Date(scheduledStart);
    const endTime = new Date(scheduledEnd);
    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    const pricePaid = parseFloat(tutor.hourlyRate.toString()) * durationHours;
    const platformFee = pricePaid * 0.10; // 10% platform fee
    const tutorEarnings = pricePaid - platformFee;

    // Create the session
  const session = await prisma.session.create({
    data: {
      tuteeId: tuteeProfile.id,
        tutorId: tutor.id,
        subjectId,
        statusId: 1, // Pending
        scheduledStart: startTime,
        scheduledEnd: endTime,
        sessionType: sessionType || 'online',
        sessionNotes: notes,
        pricePaid: BigInt(Math.round(pricePaid * 100)), // Convert to cents
        platformFee: BigInt(Math.round(platformFee * 100)),
        tutorEarnings: BigInt(Math.round(tutorEarnings * 100)),
        currency: 'USD'
    },
    include: {
        subject: true,
      tutor: {
        include: {
          user: {
            select: {
                id: true,
              firstName: true,
              lastName: true,
              email: true
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
                email: true
              }
            }
          }
        }
    }
  });

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    logger.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create session'
    });
  }
});

// Update session status
router.put('/:sessionId/status', verifySupabaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionId } = req.params;
    const { statusId } = req.body;
    const userId = req.user.id;

    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        OR: [
          { tutee: { userId } },
          { tutor: { userId } }
        ]
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Validate status transition
    const validTransitions = {
      1: [2, 4], // Pending -> Confirmed, Cancelled
      2: [3, 4], // Confirmed -> In Progress, Cancelled
      3: [5, 6], // In Progress -> Completed, Cancelled
      4: [], // Cancelled - no further transitions
      5: [], // Completed - no further transitions
      6: [] // Cancelled - no further transitions
    };

    const allowedStatuses = validTransitions[session.statusId as keyof typeof validTransitions] || [];
    if (!allowedStatuses.includes(statusId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status transition'
      });
    }

    // Update session status
    const updatedSession = await prisma.session.update({
    where: { id: sessionId },
      data: {
        statusId,
        ...(statusId === 3 && { actualStart: new Date() }), // Set actual start when session begins
        ...(statusId === 5 && { actualEnd: new Date() }) // Set actual end when session completes
      },
    include: {
        subject: true,
      tutor: {
        include: {
          user: {
            select: {
                id: true,
              firstName: true,
              lastName: true,
              email: true
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
              email: true
            }
          }
        }
      }
    }
  });

    res.json({
      success: true,
      data: updatedSession
    });
  } catch (error) {
    logger.error('Error updating session status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update session status'
    });
  }
});

// Cancel a session
router.put('/:sessionId/cancel', verifySupabaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        OR: [
          { tutee: { userId } },
          { tutor: { userId } }
        ]
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Only allow cancellation if session hasn't started
    if (session.statusId >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a session that has already started'
      });
  }

  const updatedSession = await prisma.session.update({
    where: { id: sessionId },
    data: {
        statusId: 4, // Cancelled
        cancellationReason: 'Cancelled by user'
    },
    include: {
        subject: true,
      tutor: {
        include: {
          user: {
            select: {
                id: true,
              firstName: true,
                lastName: true,
                email: true
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
                email: true
              }
            }
          }
        }
    }
  });

    res.json({
      success: true,
      data: updatedSession
    });
  } catch (error) {
    logger.error('Error cancelling session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel session'
    });
  }
});

export default router; 