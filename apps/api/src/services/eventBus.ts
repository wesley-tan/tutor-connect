import { PrismaClient } from '@tutorconnect/database';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface TutorConnectEvent {
  type: string;
  payload: any;
  metadata: {
    userId?: string;
    sessionId?: string;
    timestamp: Date;
    correlationId: string;
    source?: string;
  };
}

export class EventBus extends EventEmitter {
  constructor(private prisma: PrismaClient) {
    super();
    this.setMaxListeners(50); // Increase for high-traffic scenarios
  }

  /**
   * Emit an event with proper logging and persistence
   */
  async emit(eventType: string, payload: any, metadata: Partial<TutorConnectEvent['metadata']> = {}): Promise<boolean> {
    const event: TutorConnectEvent = {
      type: eventType,
      payload,
      metadata: {
        timestamp: new Date(),
        correlationId: crypto.randomUUID(),
        source: 'api',
        ...metadata
      }
    };

    try {
      // Store in database for reliability and audit trail
      await this.prisma.eventLog.create({
        data: {
          type: eventType,
          payload: JSON.stringify(payload),
          metadata: JSON.stringify(event.metadata),
          status: 'pending'
        }
      });

      // Emit via PostgreSQL NOTIFY for real-time processing
      await this.prisma.$executeRaw`
        NOTIFY tutorconnect_events, ${JSON.stringify(event)}
      `;

      // Also emit locally for immediate handlers
      super.emit(eventType, event);
      super.emit('*', event); // Wildcard for global listeners

      logger.debug('Event emitted', {
        eventType,
        correlationId: event.metadata.correlationId,
        userId: event.metadata.userId
      });

      return true;
    } catch (error) {
      logger.error('Failed to emit event', {
        eventType,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: event.metadata.correlationId
      });
      return false;
    }
  }

  /**
   * Mark an event as processed
   */
  async markEventProcessed(eventId: string, error?: Error): Promise<void> {
    try {
      await this.prisma.eventLog.update({
        where: { id: eventId },
        data: {
          status: error ? 'failed' : 'processed',
          processedAt: new Date(),
          errorMessage: error?.message,
          retryCount: error ? { increment: 1 } : undefined
        }
      });
    } catch (updateError) {
      logger.error('Failed to mark event as processed', {
        eventId,
        error: updateError instanceof Error ? updateError.message : 'Unknown error'
      });
    }
  }

  /**
   * Get pending events for retry processing
   */
  async getPendingEvents(limit: number = 100): Promise<any[]> {
    return await this.prisma.eventLog.findMany({
      where: {
        status: 'pending',
        retryCount: { lt: 3 } // Max 3 retries
      },
      orderBy: { createdAt: 'asc' },
      take: limit
    });
  }

  /**
   * Retry failed events
   */
  async retryFailedEvents(): Promise<void> {
    const failedEvents = await this.prisma.eventLog.findMany({
      where: {
        status: 'failed',
        retryCount: { lt: 3 },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      },
      take: 50
    });

    for (const eventLog of failedEvents) {
      try {
        const payload = JSON.parse(eventLog.payload);
        const metadata = JSON.parse(eventLog.metadata as string);
        
        await this.emit(eventLog.type, payload, metadata);
        await this.markEventProcessed(eventLog.id);
        
        logger.info('Event retried successfully', {
          eventId: eventLog.id,
          eventType: eventLog.type
        });
      } catch (error) {
        await this.markEventProcessed(eventLog.id, error instanceof Error ? error : new Error('Retry failed'));
        
        logger.error('Event retry failed', {
          eventId: eventLog.id,
          eventType: eventLog.type,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Clean up old processed events
   */
  async cleanupOldEvents(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const result = await this.prisma.eventLog.deleteMany({
      where: {
        status: 'processed',
        processedAt: { lt: cutoffDate }
      }
    });

    logger.info('Old events cleaned up', {
      deletedCount: result.count,
      cutoffDate
    });

    return result.count;
  }

  /**
   * Register event handlers with error handling
   */
  onEvent(eventType: string, handler: (event: TutorConnectEvent) => Promise<void>): void {
    this.on(eventType, async (event: TutorConnectEvent) => {
      try {
        await handler(event);
        logger.debug('Event handler completed', {
          eventType,
          correlationId: event.metadata.correlationId
        });
      } catch (error) {
        logger.error('Event handler failed', {
          eventType,
          correlationId: event.metadata.correlationId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        // Could implement dead letter queue here for critical events
      }
    });
  }

  /**
   * Register a global event listener (listens to all events)
   */
  onAnyEvent(handler: (event: TutorConnectEvent) => Promise<void>): void {
    this.onEvent('*', handler);
  }

  /**
   * Get event statistics
   */
  async getEventStats(hours: number = 24): Promise<any> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const stats = await this.prisma.eventLog.groupBy({
      by: ['type', 'status'],
      where: { createdAt: { gte: since } },
      _count: true
    });

    const summary = stats.reduce((acc, stat) => {
      if (!acc[stat.type]) {
        acc[stat.type] = { pending: 0, processed: 0, failed: 0 };
      }
      acc[stat.type][stat.status] = stat._count;
      return acc;
    }, {} as Record<string, Record<string, number>>);

    return {
      period: `${hours} hours`,
      events: summary,
      total: stats.reduce((sum, stat) => sum + stat._count, 0)
    };
  }
}

// Event type constants for type safety
export const EVENT_TYPES = {
  // User events
  USER_REGISTERED: 'user.registered',
  USER_EMAIL_VERIFIED: 'user.email_verified',
  USER_PROFILE_UPDATED: 'user.profile_updated',
  USER_DEACTIVATED: 'user.deactivated',

  // Session events
  SESSION_BOOKED: 'session.booked',
  SESSION_STARTED: 'session.started',
  SESSION_COMPLETED: 'session.completed',
  SESSION_CANCELLED: 'session.cancelled',
  SESSION_NO_SHOW: 'session.no_show',

  // Payment events
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',

  // Message events
  MESSAGE_SENT: 'message.sent',
  MESSAGE_READ: 'message.read',

  // Review events
  REVIEW_SUBMITTED: 'review.submitted',
  REVIEW_RESPONDED: 'review.responded',

  // Tutor events
  TUTOR_APPROVED: 'tutor.approved',
  TUTOR_SUSPENDED: 'tutor.suspended',
  TUTOR_AVAILABILITY_UPDATED: 'tutor.availability_updated',

  // System events
  BACKGROUND_CHECK_COMPLETED: 'system.background_check_completed',
  PAYMENT_WEBHOOK_RECEIVED: 'system.payment_webhook_received',
  EMAIL_SENT: 'system.email_sent',
  SMS_SENT: 'system.sms_sent'
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES]; 