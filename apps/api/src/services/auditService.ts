import { prisma } from '@tutorconnect/database';
import { logger } from '../utils/logger';
import type { AuthenticatedRequest } from '../utils/supabaseAuth';
import type { Prisma } from '@prisma/client';

export type AuditAction = 
  | 'auth.login'
  | 'auth.logout'
  | 'auth.register'
  | 'auth.password_reset'
  | 'auth.profile_update'
  | 'auth.email_verify'
  | 'auth.failed_attempt'
  | 'session.create'
  | 'session.update'
  | 'session.delete'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'request.create'
  | 'request.update'
  | 'request.delete';

export type AuditResource = 
  | 'auth'
  | 'session'
  | 'user'
  | 'request'
  | 'conversation'
  | 'message'
  | 'payment';

export interface AuditMetadata {
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  errorCode?: string;
  errorMessage?: string;
  [key: string]: any;
}

export class AuditService {
  static async log(
    req: AuthenticatedRequest,
    action: AuditAction,
    resource: AuditResource,
    resourceId?: string | null,
    oldValues?: any,
    newValues?: any,
    metadata?: AuditMetadata
  ) {
    try {
      const userId = req.user?.id;
      
      const auditLog = await prisma.auditLog.create({
        data: {
          userId,
          action,
          resource,
          resourceId: resourceId ?? null,
          oldValues: oldValues ?? null,
          newValues: newValues ?? null,
          metadata: {
            ip: req.ip,
            userAgent: req.get('user-agent'),
            path: req.path,
            method: req.method,
            ...metadata
          },
          ipAddress: req.ip ?? null,
          userAgent: req.get('user-agent') ?? null
        }
      });

      logger.info('Audit log created', {
        id: auditLog.id,
        userId,
        action,
        resource,
        resourceId
      });

      return auditLog;
    } catch (error) {
      logger.error('Failed to create audit log', {
        error,
        userId: req.user?.id,
        action,
        resource,
        resourceId
      });
      
      // Don't throw - audit logging should never break the main flow
      return null;
    }
  }

  static async getAuditLogs(
    userId?: string,
    resource?: AuditResource,
    action?: AuditAction,
    startDate?: Date,
    endDate?: Date,
    page = 1,
    limit = 20
  ) {
    try {
      const where: any = {};
      
      if (userId) where.userId = userId;
      if (resource) where.resource = resource;
      if (action) where.action = action;
      
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const [total, logs] = await prisma.$transaction([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        })
      ]);

      return {
        data: logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to fetch audit logs', { error });
      throw error;
    }
  }

  static async getUserAuditTrail(userId: string, page = 1, limit = 20) {
    return this.getAuditLogs(userId, undefined, undefined, undefined, undefined, page, limit);
  }

  static async getResourceAuditTrail(resource: AuditResource, resourceId: string, page = 1, limit = 20) {
    try {
      const [total, logs] = await prisma.$transaction([
        prisma.auditLog.count({
          where: {
            resource,
            resourceId
          }
        }),
        prisma.auditLog.findMany({
          where: {
            resource,
            resourceId
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        })
      ]);

      return {
        data: logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to fetch resource audit trail', {
        error,
        resource,
        resourceId
      });
      throw error;
    }
  }
} 