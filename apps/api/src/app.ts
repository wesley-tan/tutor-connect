import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { errorHandler } from './middleware/errorHandlers';
import { requestLogger } from './utils/logger';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Routes
import authRouter from './routes/auth';
import requestsRouter from './routes/requests';
import sessionsRouter from './routes/sessions';
import conversationsRouter from './routes/conversations';
import messagesRouter from './routes/messages';
import tutorsRouter from './routes/tutors';
import usersRouter from './routes/users';
import reviewsRouter from './routes/reviews';
import paymentsRouter from './routes/payments';
import webhooksRouter from './routes/webhooks';
import subjectsRouter from './routes/subjects';

app.use('/api/auth', authRouter); // Changed from /api/v1/auth for compatibility
app.use('/api/requests', requestsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/tutors', tutorsRouter);
app.use('/api/users', usersRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/subjects', subjectsRouter);

// Error handling
app.use(errorHandler);

export default app; 