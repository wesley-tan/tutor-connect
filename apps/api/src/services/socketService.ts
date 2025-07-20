import { Server as SocketServer, Socket } from 'socket.io';
import { PrismaClient } from '@tutorconnect/database';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userType?: string;
}

export class SocketService {
  private connectedUsers = new Map<string, string>(); // userId -> socketId
  
  constructor(
    private io: SocketServer,
    private prisma: PrismaClient
  ) {
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware for socket connections
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        
        // Verify user exists and is active
        const user = await this.prisma.user.findFirst({
          where: {
            id: decoded.userId,
            isActive: true,
            deletedAt: null
          }
        });

        if (!user) {
          return next(new Error('Invalid user'));
        }

        socket.userId = user.id;
        socket.userType = user.userType;
        
        logger.info('Socket authenticated', {
          socketId: socket.id,
          userId: user.id,
          userType: user.userType
        });

        next();
      } catch (error) {
        logger.error('Socket authentication failed', {
          socketId: socket.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: AuthenticatedSocket) {
    const userId = socket.userId!;
    
    logger.info('User connected via WebSocket', {
      socketId: socket.id,
      userId,
      userType: socket.userType
    });

    // Store connection
    this.connectedUsers.set(userId, socket.id);

    // Join user to their personal room
    socket.join(`user:${userId}`);

    // Join user type specific rooms
    socket.join(`${socket.userType}s`);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info('User disconnected from WebSocket', {
        socketId: socket.id,
        userId,
        reason
      });
      
      this.connectedUsers.delete(userId);
    });

    // Handle chat messages
    socket.on('send_message', async (data) => {
      try {
        await this.handleSendMessage(socket, data);
      } catch (error) {
        logger.error('Error handling send_message', {
          socketId: socket.id,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        socket.emit('error', {
          event: 'send_message',
          message: 'Failed to send message'
        });
      }
    });

    // Handle message read receipts
    socket.on('mark_message_read', async (data) => {
      try {
        await this.handleMarkMessageRead(socket, data);
      } catch (error) {
        logger.error('Error handling mark_message_read', {
          socketId: socket.id,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      this.handleTypingIndicator(socket, data, true);
    });

    socket.on('typing_stop', (data) => {
      this.handleTypingIndicator(socket, data, false);
    });

    // Handle session events
    socket.on('join_session', (sessionId: string) => {
      socket.join(`session:${sessionId}`);
      logger.debug('User joined session room', { userId, sessionId });
    });

    socket.on('leave_session', (sessionId: string) => {
      socket.leave(`session:${sessionId}`);
      logger.debug('User left session room', { userId, sessionId });
    });

    // Send connection success
    socket.emit('connected', {
      userId,
      userType: socket.userType,
      timestamp: new Date().toISOString()
    });
  }

  private async handleSendMessage(socket: AuthenticatedSocket, data: any) {
    const { conversationId, receiverId, messageText, messageType = 'text' } = data;
    const senderId = socket.userId!;

    // Validate conversation exists and user is participant
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { participantA: senderId, participantB: receiverId },
          { participantA: receiverId, participantB: senderId }
        ]
      }
    });

    if (!conversation) {
      throw new Error('Invalid conversation');
    }

    // Create message
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        receiverId,
        messageText,
        messageType
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImageUrl: true
          }
        }
      }
    });

    // Update conversation last message time
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() }
    });

    // Emit to both sender and receiver
    const messageData = {
      id: message.id,
      conversationId,
      senderId,
      receiverId,
      messageText,
      messageType,
      isRead: false,
      createdAt: message.createdAt,
      sender: message.sender
    };

    // Send to sender (confirmation)
    socket.emit('message_sent', messageData);

    // Send to receiver if online
    this.io.to(`user:${receiverId}`).emit('new_message', messageData);

    logger.debug('Message sent', {
      messageId: message.id,
      senderId,
      receiverId,
      conversationId
    });
  }

  private async handleMarkMessageRead(socket: AuthenticatedSocket, data: any) {
    const { messageId } = data;
    const userId = socket.userId!;

    // Update message read status
    const message = await this.prisma.message.update({
      where: {
        id: messageId,
        receiverId: userId // Ensure user can only mark their own messages as read
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    // Notify sender about read receipt
    this.io.to(`user:${message.senderId}`).emit('message_read', {
      messageId,
      readAt: message.readAt
    });

    logger.debug('Message marked as read', {
      messageId,
      userId,
      senderId: message.senderId
    });
  }

  private handleTypingIndicator(socket: AuthenticatedSocket, data: any, isTyping: boolean) {
    const { conversationId, receiverId } = data;
    const userId = socket.userId!;

    // Send typing indicator to receiver
    this.io.to(`user:${receiverId}`).emit('typing_indicator', {
      conversationId,
      userId,
      isTyping,
      timestamp: new Date().toISOString()
    });
  }

  // Public methods for external use

  /**
   * Send notification to a specific user
   */
  public notifyUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });

    logger.debug('Notification sent', {
      userId,
      event,
      data
    });
  }

  /**
   * Send notification to all users of a specific type
   */
  public notifyUserType(userType: 'student' | 'parent' | 'tutor', event: string, data: any) {
    this.io.to(`${userType}s`).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });

    logger.debug('Notification sent to user type', {
      userType,
      event,
      data
    });
  }

  /**
   * Send session update to all participants
   */
  public notifySession(sessionId: string, event: string, data: any) {
    this.io.to(`session:${sessionId}`).emit(event, {
      ...data,
      sessionId,
      timestamp: new Date().toISOString()
    });

    logger.debug('Session notification sent', {
      sessionId,
      event,
      data
    });
  }

  /**
   * Broadcast system-wide notification
   */
  public broadcast(event: string, data: any) {
    this.io.emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });

    logger.info('System broadcast sent', {
      event,
      data
    });
  }

  /**
   * Get online status of a user
   */
  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Get connected users count
   */
  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Get connected users by type
   */
  public getConnectedUsersByType(): Record<string, number> {
    const sockets = Array.from(this.io.sockets.sockets.values()) as AuthenticatedSocket[];
    
    const counts = sockets.reduce((acc, socket) => {
      const userType = socket.userType || 'unknown';
      acc[userType] = (acc[userType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return counts;
  }
} 