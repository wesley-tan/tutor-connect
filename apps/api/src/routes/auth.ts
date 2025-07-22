import { Router } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/authService';
import { logger } from '../utils/logger';
import rateLimit from 'express-rate-limit';

const router = Router();
const authService = new AuthService();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: {
      message: 'Too many login attempts, please try again later',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  }
});

// Input validation schemas
const GoogleAuthSchema = z.object({
  idToken: z.string().min(1, 'ID token is required')
});

const MagicLinkSchema = z.object({
  email: z.string().email('Invalid email address')
});

// Google OAuth authentication
router.post('/google', authLimiter, async (req, res) => {
  try {
    const { idToken } = GoogleAuthSchema.parse(req.body);
    
    const { user, session } = await authService.authenticateWithGoogle(idToken);
    
    logger.info('User authenticated via Google', {
      userId: user.id,
      email: user.email
    });

    res.json({
      success: true,
      data: {
        user,
        session
      }
    });
  } catch (error) {
    logger.error('Google auth error', { error });
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Invalid request data',
          details: error.errors
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Authentication failed',
        code: 'AUTH_ERROR'
      }
    });
  }
});

// Magic link authentication
router.post('/magic-link', authLimiter, async (req, res) => {
  try {
    const { email } = MagicLinkSchema.parse(req.body);
    
    const { user, magicLink } = await authService.sendMagicLink(email);
    
    logger.info('Magic link sent', {
      userId: user.id,
      email: user.email
    });

    res.json({
      success: true,
      data: {
        message: 'Magic link sent successfully',
        email
      }
    });
  } catch (error) {
    logger.error('Magic link error', { error });
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Invalid request data',
          details: error.errors
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to send magic link',
        code: 'MAGIC_LINK_ERROR'
      }
    });
  }
});

// Verify session
router.get('/session', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          message: 'No token provided',
          code: 'NO_TOKEN'
        }
      });
      return;
    }

    const { user, session } = await authService.verifySession(token);
    
    res.json({
      success: true,
      data: {
        user,
        session
      }
    });
  } catch (error) {
    logger.error('Session verification error', { error });
    
    res.status(401).json({
      success: false,
      error: {
        message: 'Invalid or expired session',
        code: 'INVALID_SESSION'
      }
    });
  }
});

export default router; 