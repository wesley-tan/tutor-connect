import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';
import { rateLimit } from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { authenticateToken } from './utils/supabaseAuth';
import { errorHandler } from './middleware/errorHandlers';
import { requestLogger, stream } from './utils/logger';
import { csrfProtection, initializeCsrf } from './middleware/csrf';
import morgan from 'morgan';

// Import routers
import sessionsRouter from './routes/sessions';
import conversationsRouter from './routes/conversations';
import tutorsRouter from './routes/tutors';
import usersRouter from './routes/users';
import authRouter from './routes/auth';
import referenceRouter from './routes/reference';
import requestsRouter from './routes/requests';

const app = express();

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  process.env.FRONTEND_URL || 'http://localhost:3000'
].filter(Boolean);

// Enhanced security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", ...allowedOrigins],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true
}));

// CORS setup
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  exposedHeaders: ['X-CSRF-Token'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // 24 hours
}));

// Handle preflight requests
app.options('*', cors());

// Request parsing with size limits
app.use(json({ limit: '10kb' }));
app.use(urlencoded({ extended: true, limit: '10kb' }));
app.use(compression());
app.use(cookieParser(process.env.COOKIE_SECRET));

// Logging
app.use(morgan('combined', { stream }));
app.use(requestLogger);

// Rate limiting configuration
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Increased from 1000
  message: { 
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/v1/health' || req.path === '/api/v1/auth/me' || req.path.startsWith('/api/v1/reference') // Don't rate limit health checks, auth checks, and reference data
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Increased from 50
  message: { 
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/v1/auth/me' // Don't rate limit auth checks
});

// Apply rate limiting
app.use('/api/v1/auth', authLimiter);
app.use('/api/v1', globalLimiter);

// Initialize CSRF protection
app.use(initializeCsrf);

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ 
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    }
  });
});

// API routes
const apiRouter = express.Router();

// Public routes (no auth required)
apiRouter.use('/auth', authRouter);
apiRouter.use('/reference', referenceRouter);

// Protected routes (require authentication and CSRF)
const protectedRoutes = express.Router();
protectedRoutes.use(authenticateToken);
protectedRoutes.use(csrfProtection);

protectedRoutes.use('/sessions', sessionsRouter);
protectedRoutes.use('/conversations', conversationsRouter);
protectedRoutes.use('/tutors', tutorsRouter);
protectedRoutes.use('/users', usersRouter);
protectedRoutes.use('/requests', requestsRouter);

// Mount routes
apiRouter.use('/', protectedRoutes);
app.use('/api/v1', apiRouter);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
    code: 'NOT_FOUND',
    message: `Cannot ${req.method} ${req.path}`
    }
  });
});

// Force port 3006
const port = 3006;

app.listen(port, () => {
  console.log(`🚀 Server ready at http://localhost:${port}`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 CORS Origins: ${allowedOrigins.join(', ')}`);
}); 