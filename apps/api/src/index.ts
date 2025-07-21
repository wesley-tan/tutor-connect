import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';

import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@tutorconnect/database';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

// Import custom middleware and routes
import { errorHandler, notFoundHandler } from './middleware/errorHandlers';
import { telemetryMiddleware } from './middleware/telemetry';
import { logger } from './utils/logger';
import { redis } from './config/redis';
import { EventBus } from './services/eventBus';
import { SocketService } from './services/socketService';

// Import route modules
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import tutorRoutes from './routes/tutors.js';
import sessionRoutes from './routes/sessions.js';
import paymentRoutes from './routes/payments.js';
import messageRoutes from './routes/messages.js';
import webhookRoutes from './routes/webhooks.js';
import conversationRoutes from './routes/conversations.js';
import reviewRoutes from './routes/reviews.js';
import referenceRoutes from './routes/reference.js';

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Environment validation
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Optional Redis for development
if (!process.env.REDIS_URL && NODE_ENV === 'development') {
  logger.warn('Redis URL not provided. Some features may not work properly in development.');
}

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Initialize services
const prisma = new PrismaClient({
  log: NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

const eventBus = new EventBus(prisma);

// Initialize Socket.IO
const io = new SocketServer(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    credentials: true
  }
});

const socketService = new SocketService(io, prisma);

// Trust proxy for accurate IP addresses in production
if (NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      frameSrc: ["https://checkout.stripe.com"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200, // Support legacy browsers
  preflightContinue: false
}));

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req: any, res, buf) => {
    // Store raw body for Stripe webhook verification
    if (req.originalUrl?.includes('/webhooks/stripe')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: {
    write: (message: string) => {
      logger.info(message.trim());
    }
  }
}));

// Telemetry middleware for monitoring
app.use(telemetryMiddleware);

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // TODO: Use Redis for distributed rate limiting in production
});

app.use('/api', globalLimiter);

// Auth-specific rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '5'),
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Redis is optional - don't fail health check if Redis is not available
    // if (redis) {
    //   await redis.ping();
    // }
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/tutors', tutorRoutes);
app.use('/api/v1/sessions', sessionRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1', referenceRoutes); // Reference routes for subjects, certifications, etc.
app.use('/webhooks', webhookRoutes); // Webhooks outside API versioning

// Add context to request object
app.use((req: any, res, next) => {
  req.prisma = prisma;
  req.eventBus = eventBus;
  req.redis = redis || null;
  req.io = io;
  next();
});

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  httpServer.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      await prisma.$disconnect();
      logger.info('Database connection closed');
      
      if (redis) {
        await redis.quit();
        logger.info('Redis connection closed');
      }
      
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

// Handle shutdown signals
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

// Start server
httpServer.listen(PORT, () => {
  logger.info(`🚀 TutorConnect API server running on port ${PORT}`);
  logger.info(`📖 Environment: ${NODE_ENV}`);
  logger.info(`🌐 Frontend URL: ${FRONTEND_URL}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
  
  if (NODE_ENV === 'development') {
    logger.info(`📊 Database Studio: npx prisma studio`);
    logger.info(`🔍 API Documentation: http://localhost:${PORT}/api/v1/docs`);
  }
});

export { app, httpServer, prisma, eventBus, socketService }; 