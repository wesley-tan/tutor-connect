import { Router, Request, Response } from 'express';
import { prisma } from '@tutorconnect/database';
import { logger } from '../utils/logger';
import { authenticateToken, AuthenticatedRequest } from '../utils/supabaseAuth';

const router = Router();

// Get all tutoring requests (filtered by user type)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const userId = authenticatedReq.user.id;
    const { status, subject, page = 1, limit = 10 } = req.query;
    
    // Get user type
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Build query
    const where: any = {};
    if (status) where.status = status;
    if (subject) where.subjectId = subject;

    // Students see only their requests, tutors see all open requests
    if (user.userType === 'student') {
      where.tuteeId = userId;
    } else if (user.userType === 'tutor') {
      where.status = 'open';
    }

    // Get total count
    const total = await prisma.tutoringRequest.count({ where });

    // Get paginated requests
    const requests = await prisma.tutoringRequest.findMany({
      where,
      include: {
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
        responses: {
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
            }
          }
        }
      },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
      orderBy: { createdAt: 'desc' }
    });

    return res.json({
      success: true,
      data: requests,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    logger.error('Error fetching tutoring requests:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tutoring requests'
    });
  }
});

// Get a specific tutoring request
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const userId = authenticatedReq.user.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Request ID is required'
      });
    }

    const request = await prisma.tutoringRequest.findUnique({
      where: { id },
      include: {
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
        responses: {
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
            }
          }
        }
      }
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Tutoring request not found'
      });
    }

    // Check if user has permission to view this request
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Students can only see their own requests, tutors can see all
    if (user.userType === 'student' && request.tuteeId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    return res.json({
      success: true,
      data: request
    });
  } catch (error) {
    logger.error('Error fetching tutoring request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tutoring request'
    });
  }
});

// Create a new tutoring request
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const userId = authenticatedReq.user.id;
    const { subjectId, title, description, preferredSchedule, budget, urgency } = req.body;

    // Validate required fields
    if (!subjectId || !title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Subject, title, and description are required'
      });
    }

    // Check if user is a student
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tuteeProfile: true
      }
    });

    if (!user || user.userType !== 'student' || !user.tuteeProfile) {
      return res.status(403).json({
        success: false,
        message: 'Only students can create tutoring requests'
      });
    }

    // Create the tutoring request
    const request = await prisma.tutoringRequest.create({
      data: {
        tuteeId: user.tuteeProfile.id,
        subjectId,
        title,
        description,
        preferredSchedule,
        budget: budget ? parseFloat(budget) : null,
        urgency: urgency || 'normal',
        status: 'open'
      },
      include: {
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
        subject: true
      }
    });

    return res.status(201).json({
      success: true,
      data: request
    });
  } catch (error) {
    logger.error('Error creating tutoring request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create tutoring request'
    });
  }
});

// Update a tutoring request
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const userId = authenticatedReq.user.id;
    const { title, description, preferredSchedule, budget, urgency, status } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Request ID is required'
      });
    }

    // Check if request exists and user has permission
    const existingRequest = await prisma.tutoringRequest.findFirst({
      where: { id },
      include: {
        tutee: {
          include: {
            user: true
          }
        }
      }
    });

    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        message: 'Tutoring request not found'
      });
    }

    // Only the creator can update the request
    if (existingRequest.tutee.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update the request
    const updatedRequest = await prisma.tutoringRequest.update({
      where: { id },
      data: {
        title,
        description,
        preferredSchedule,
        budget: budget ? parseFloat(budget) : null,
        urgency,
        status
      },
      include: {
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
        subject: true
      }
    });

    return res.json({
      success: true,
      data: updatedRequest
    });
  } catch (error) {
    logger.error('Error updating tutoring request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update tutoring request'
    });
  }
});

// Delete a tutoring request
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const userId = authenticatedReq.user.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Request ID is required'
      });
    }

    // Check if request exists and user has permission
    const existingRequest = await prisma.tutoringRequest.findFirst({
      where: { id },
      include: {
        tutee: {
          include: {
            user: true
          }
        }
      }
    });

    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        message: 'Tutoring request not found'
      });
    }

    // Only the creator can delete the request
    if (existingRequest.tutee.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete the request
    await prisma.tutoringRequest.delete({
      where: { id }
    });

    return res.json({
      success: true,
      message: 'Tutoring request deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting tutoring request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete tutoring request'
    });
  }
});

// Create a response to a tutoring request
router.post('/:requestId/responses', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const { requestId } = req.params;
    const userId = authenticatedReq.user.id;
    const { message, proposedRate, proposedSchedule } = req.body;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: 'Request ID is required'
      });
    }

    // Validate required fields
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Response message is required'
      });
    }

    // Check if user is a tutor
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tutorProfile: true
      }
    });

    if (!user || user.userType !== 'tutor' || !user.tutorProfile) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can respond to requests'
      });
    }

    // Check if request exists
    const request = await prisma.tutoringRequest.findFirst({
      where: { id: requestId }
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Tutoring request not found'
      });
    }

    // Check if tutor has already responded
    const existingResponse = await prisma.requestResponse.findFirst({
      where: {
        requestId,
        tutorId: user.tutorProfile.id
      }
    });

    if (existingResponse) {
      return res.status(400).json({
        success: false,
        message: 'You have already responded to this request'
      });
    }

    // Create the response
    const response = await prisma.requestResponse.create({
      data: {
        requestId,
        tutorId: user.tutorProfile.id,
        message,
        proposedRate: proposedRate ? parseFloat(proposedRate) : null,
        proposedSchedule
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
        }
      }
    });

    return res.status(201).json({
      success: true,
      data: response
    });
  } catch (error) {
    logger.error('Error creating request response:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create request response'
    });
  }
});

// Accept a tutor's response
router.post('/:requestId/responses/:responseId/accept', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const { requestId, responseId } = req.params;
    const userId = authenticatedReq.user.id;

    if (!requestId || !responseId) {
      return res.status(400).json({
        success: false,
        message: 'Request ID and Response ID are required'
      });
    }

    // Check if request exists and user owns it
    const request = await prisma.tutoringRequest.findFirst({
      where: { id: requestId },
      include: {
        tutee: {
          include: {
            user: true
          }
        }
      }
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Tutoring request not found'
      });
    }

    if (request.tutee.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if response exists
    const response = await prisma.requestResponse.findFirst({
      where: { 
        id: responseId,
        requestId
      },
      include: {
        tutor: {
          include: {
            user: true
          }
        }
      }
    });

    if (!response) {
      return res.status(404).json({
        success: false,
        message: 'Response not found'
      });
    }

    // Update response and request status
    const [updatedResponse, updatedRequest] = await prisma.$transaction([
      prisma.requestResponse.update({
        where: { id: responseId },
        data: { isAccepted: true }
      }),
      prisma.tutoringRequest.update({
        where: { id: requestId },
        data: { status: 'in_progress' }
      })
    ]);

    // Create or get conversation between student and tutor
    const conversation = await prisma.conversation.upsert({
      where: {
        participantA_participantB: {
          participantA: userId,
          participantB: response.tutor.user.id
        }
      },
      create: {
        participantA: userId,
        participantB: response.tutor.user.id
      },
      update: {}
    });

    return res.json({
      success: true,
      data: {
        response: updatedResponse,
        request: updatedRequest,
        conversation
      }
    });
  } catch (error) {
    logger.error('Error accepting request response:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to accept response'
    });
  }
});

export default router; 