import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticateSupabaseToken, mockAuth } from './utils/supabaseAuth';
import { errorHandler } from './middleware/errorHandlers';
import { requestLogger, stream } from './utils/logger';
import morgan from 'morgan';

// Import routers
import sessionsRouter from './routes/sessions';
import conversationsRouter from './routes/conversations';
import tutorsRouter from './routes/tutors';
import usersRouter from './routes/users';
import authRouter from './routes/auth';
import referenceRouter from './routes/reference';

const app = express();

// CORS configuration - allow multiple origins for development
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  process.env.FRONTEND_URL || 'http://localhost:3000'
];

// Basic security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" }
}));

// CORS setup
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Handle preflight requests
app.options('*', cors());

// Request parsing
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(compression());

// Logging
app.use(morgan('combined', { stream }));
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use(limiter);

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Conditional authentication for development
const useAuth = false; // Temporarily force mock auth for testing
const authMiddleware = useAuth ? authenticateSupabaseToken : mockAuth;

// API routes
const apiRouter = express.Router();
apiRouter.use('/auth', authRouter);
apiRouter.use('/sessions', authMiddleware, sessionsRouter);
apiRouter.use('/conversations', authMiddleware, conversationsRouter);
apiRouter.use('/tutors', authMiddleware, tutorsRouter);
apiRouter.use('/users', authMiddleware, usersRouter);
apiRouter.use('/', referenceRouter);

// Mount all routes under /api/v1
app.use('/api/v1', apiRouter);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    code: 'NOT_FOUND',
    message: `Cannot ${req.method} ${req.path}`
  });
});

const port = process.env.PORT || 3006;

app.listen(port, () => {
  console.log(`🚀 Server ready at http://localhost:${port}`);
  console.log(`📋 Authentication: ${useAuth ? 'Supabase' : 'Mock (Development)'}`);
  console.log(`🌐 CORS Origins: ${allowedOrigins.join(', ')}`);
}); 