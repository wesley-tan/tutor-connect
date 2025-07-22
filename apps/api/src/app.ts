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

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/requests', requestsRouter);
app.use('/api/v1/sessions', sessionsRouter);
app.use('/api/v1/conversations', conversationsRouter);
app.use('/api/v1/messages', messagesRouter);
app.use('/api/v1/tutors', tutorsRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/reviews', reviewsRouter);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/webhooks', webhooksRouter);

// Error handling
app.use(errorHandler);

export default app; 