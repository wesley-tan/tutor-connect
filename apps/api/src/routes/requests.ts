import { Router, Request, Response } from 'express';
import { prisma } from '@tutorconnect/database';
import { logger } from '../utils/logger';
import { authenticateSupabaseToken, AuthenticatedRequest } from '../utils/supabaseAuth';

const router = Router();

// Get all tutoring requests (filtered by user type)
router.get('/', authenticateSupabaseToken, async (req: Request, res: Response) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const userId = authenticatedReq.user.id;
    const { status, subject, page = 1, limit = 10 } = req.query;
    
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let whereClause: any = {};

    // Filter by status if provided
    if (status) {
      whereClause.status = status;
    }

    // Filter by subject if provided
    if (subject) {
      whereClause.subjectId = subject;
    }

    // Students can only see their own requests
    if (user.userType === 'student') {
      whereClause.tuteeId = userId;
    }
    // Tutors can see all open requests
    else if (user.userType === 'tutor') {
      whereClause.status = 'open';
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [requests, total] = await Promise.all([
      prisma.tutoringRequest.findMany({
        where: whereClause,
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
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: parseInt(limit as string)
      }),
      prisma.tutoringRequest.count({ where: whereClause })
    ]);

    res.json({
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
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tutoring requests'
    });
  }
});

// Get a specific tutoring request
router.get('/:id', authenticateSupabaseToken, async (req: Request, res: Response) => {
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

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    logger.error('Error fetching tutoring request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tutoring request'
    });
  }
});

// Create a new tutoring request
router.post('/', authenticateSupabaseToken, async (req: Request, res: Response) => {
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
      where: { id: userId }
    });

    if (!user || user.userType !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can create tutoring requests'
      });
    }

    // Create the tutoring request
    const request = await prisma.tutoringRequest.create({
      data: {
        tuteeId: userId,
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

    res.status(201).json({
      success: true,
      data: request
    });
  } catch (error) {
    logger.error('Error creating tutoring request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create tutoring request'
    });
  }
});

// Update a tutoring request
router.put('/:id', authenticateSupabaseToken, async (req: Request, res: Response) => {
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
    const existingRequest = await prisma.tutoringRequest.findUnique({
      where: { id }
    });

    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        message: 'Tutoring request not found'
      });
    }

    // Only the creator can update the request
    if (existingRequest.tuteeId !== userId) {
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

    res.json({
      success: true,
      data: updatedRequest
    });
  } catch (error) {
    logger.error('Error updating tutoring request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tutoring request'
    });
  }
});

// Delete a tutoring request
router.delete('/:id', authenticateSupabaseToken, async (req: Request, res: Response) => {
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
    const existingRequest = await prisma.tutoringRequest.findUnique({
      where: { id }
    });

    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        message: 'Tutoring request not found'
      });
    }

    // Only the creator can delete the request
    if (existingRequest.tuteeId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete the request
    await prisma.tutoringRequest.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Tutoring request deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting tutoring request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete tutoring request'
    });
  }
});

export default router; 