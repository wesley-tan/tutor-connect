import { Request, Response, NextFunction } from 'express';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const tracer = trace.getTracer('tutorconnect-api');

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

export const telemetryMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Generate unique request ID
  const requestId = uuidv4();
  req.requestId = requestId;
  req.startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);

  // Start OpenTelemetry span
  const span = tracer.startSpan(`${req.method} ${req.route?.path || req.path}`);

  // Set span attributes
  span.setAttributes({
    'http.method': req.method,
    'http.url': req.url,
    'http.route': req.route?.path || req.path,
    'http.scheme': req.protocol,
    'http.host': req.get('host') || '',
    'http.user_agent': req.get('user-agent') || '',
    'http.remote_addr': req.ip,
    'request.id': requestId,
    'user.id': (req as any).user?.id || '',
    'user.type': (req as any).user?.userType || ''
  });

  // Track response
  const originalSend = res.send;
  res.send = function(body: any) {
    const endTime = Date.now();
    const duration = endTime - (req.startTime || endTime);

    // Set response attributes
    span.setAttributes({
      'http.status_code': res.statusCode,
      'http.response_size': Buffer.byteLength(body || ''),
      'response.duration_ms': duration
    });

    // Set span status based on HTTP status
    if (res.statusCode >= 400) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${res.statusCode}`
      });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    // Log request completion
    logger.info('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userId: (req as any).user?.id,
      userAgent: req.get('user-agent'),
      ip: req.ip
    });

    span.end();
    return originalSend.call(this, body);
  };

  // Handle errors
  res.on('error', (error) => {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message
    });
    span.end();
  });

  // Continue with request processing in span context
  context.with(trace.setSpan(context.active(), span), () => {
    next();
  });
}; 