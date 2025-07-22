import { Router } from 'express';
import { prisma } from '@tutorconnect/database';
import { logger } from '../utils/logger';
import { authenticateToken, AuthenticatedRequest } from '../utils/supabaseAuth';

const router = Router();

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const userId = authenticatedReq.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userType: true,
        profileImageUrl: true,
        isVerified: true,
        tutorProfile: {
          select: {
            id: true,
            hourlyRate: true,
            isVerified: true,
            ratingAverage: true,
            totalReviews: true,
            subjects: {
              select: {
                subject: true,
                proficiencyLevel: true
              }
            }
          }
        },
        tuteeProfile: {
          select: {
            id: true,
            gradeLevel: true,
            schoolName: true,
            subjectNeeds: {
              select: {
                subject: true,
                urgencyLevel: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error fetching current user:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch current user'
    });
  }
});

export default router; 