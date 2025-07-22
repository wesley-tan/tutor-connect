import { Router } from 'express';
import { prisma } from '@tutorconnect/database';
import { logger } from '../utils/logger';
import { authenticateToken } from '../utils/supabaseAuth';

const router = Router();

// Get all subjects
router.get('/', authenticateToken, async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    return res.json({
      success: true,
      data: subjects
    });
  } catch (error) {
    logger.error('Error fetching subjects:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch subjects'
    });
  }
});

export default router; 