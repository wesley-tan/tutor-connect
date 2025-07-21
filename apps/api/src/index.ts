import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@tutorconnect/database';
import { Server as SocketServer } from 'socket.io';
import { createServer } from 'http';

// Import custom middleware and routes
import { errorHandler, notFoundHandler } from './middleware/errorHandlers';
import { telemetryMiddleware } from './middleware/telemetry';
import { logger } from './utils/logger';
import { authenticateSupabaseToken } from './utils/supabaseAuth';
import tutorsRouter from './routes/tutors';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  logger.warn('Missing Supabase environment variables. Backend auth will not work properly.');
}

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Initialize Express app
const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3006;

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize Socket.IO
const io = new SocketServer(httpServer, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://localhost:3005',
      'http://localhost:3006'
    ],
    credentials: true
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Socket connected:', socket.id);

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    logger.info('Socket joined room:', roomId);
  });

  socket.on('leave_room', (roomId) => {
    socket.leave(roomId);
    logger.info('Socket left room:', roomId);
  });

  socket.on('send_message', async (data) => {
    try {
      const { roomId, message, senderId } = data;
      
      // Save message to database
      const savedMessage = await prisma.message.create({
        data: {
          conversationId: roomId,
          senderId,
          messageText: message,
        }
      });

      // Broadcast message to room
      io.to(roomId).emit('receive_message', savedMessage);
    } catch (error) {
      logger.error('Error saving/sending message:', error);
    }
  });

  socket.on('disconnect', () => {
    logger.info('Socket disconnected:', socket.id);
  });
});

// Basic middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005',
    'http://localhost:3006'
  ],
  credentials: true
}));
app.use(compression());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(telemetryMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// API endpoints
app.use('/api/v1/tutors', tutorsRouter);
app.get('/api/v1/conversations', authenticateSupabaseToken, async (req: any, res) => {
  try {
    const userId = req.user.id;

    // Get all conversations where user is either participantA or participantB
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { participantA: userId },
          { participantB: userId }
        ]
      },
      include: {
        participantAUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profileImageUrl: true
          }
        },
        participantBUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profileImageUrl: true
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          select: {
            id: true,
            messageText: true,
            createdAt: true,
            senderId: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    // Format conversations
    const formattedConversations = conversations.map(conv => ({
      id: conv.id,
      participantA: conv.participantA,
      participantB: conv.participantB,
      lastMessageAt: conv.messages[0]?.createdAt,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      participantAUser: conv.participantAUser,
      participantBUser: conv.participantBUser,
      lastMessage: conv.messages[0] || null
    }));

    res.json({
      success: true,
      data: formattedConversations
    });
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations'
    });
  }
});

app.get('/api/v1/sessions', authenticateSupabaseToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;

    // Get all sessions where user is either tutor or tutee
    const sessions = await prisma.session.findMany({
      where: {
        OR: [
          { tutorId: userId },
          { tuteeId: userId }
        ]
      },
      include: {
        tutor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profileImageUrl: true
          }
        },
        tutee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profileImageUrl: true
          }
        },
        subject: true
      },
      orderBy: {
        scheduledStart: 'desc'
      }
    });

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    logger.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sessions'
    });
  }
});

app.get('/api/v1/requests', authenticateSupabaseToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;

    // If user is a tutor, show all student requests
    // If user is a student, show their own requests
    const requests = await prisma.tutorRequest.findMany({
      where: userType === 'tutor' 
        ? {} // Show all requests to tutors
        : { tuteeId: userId }, // Show only user's requests to students
      include: {
        tutee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profileImageUrl: true
          }
        },
        subject: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    logger.error('Error fetching requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch requests'
    });
  }
});

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
httpServer.listen(PORT, () => {
  logger.info(`🚀 API server running on port ${PORT}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
  logger.info(`📊 API endpoints: http://localhost:${PORT}/api/v1/`);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  httpServer.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      await prisma.$disconnect();
      logger.info('Database connection closed');
      
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
}); 