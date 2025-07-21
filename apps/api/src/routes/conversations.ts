import express, { Request, Response } from 'express';
import { prisma } from '@tutorconnect/database';
import { asyncHandler, successResponse, paginatedResponse, ValidationError, NotFoundError } from '../middleware/errorHandlers';
import { authenticateToken, AuthenticatedRequest } from '../utils/auth';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const SendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  messageType: z.enum(['text', 'image', 'file']).default('text'),
  fileUrl: z.string().url().optional()
});

const CreateConversationSchema = z.object({
  participantId: z.string(),
  sessionId: z.string().optional(),
  initialMessage: z.string().min(1).max(2000).optional()
});

// GET /api/v1/conversations - Get user's conversations
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const offset = (page - 1) * limit;

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId: user.id }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImageUrl: true,
                userType: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        session: {
          select: {
            id: true,
            scheduledStart: true,
            status: true,
            subject: { select: { name: true } }
          }
        }
      },
      skip: offset,
      take: limit,
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.conversation.count({
      where: {
        participants: {
          some: { userId: user.id }
        }
      }
    })
  ]);

  // Filter out current user from participants and add last message info
  const formattedConversations = conversations.map(conv => ({
    ...conv,
    otherParticipants: conv.participants.filter(p => p.userId !== user.id),
    lastMessage: conv.messages[0] || null,
    unreadCount: 0 // TODO: Calculate unread count
  }));

  paginatedResponse(res, formattedConversations, total, page, limit, 'Conversations retrieved successfully');
}));

// POST /api/v1/conversations - Create new conversation
router.post('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const { participantId, sessionId, initialMessage } = CreateConversationSchema.parse(req.body);

  // Check if conversation already exists between these users
  const existingConversation = await prisma.conversation.findFirst({
    where: {
      AND: [
        {
          participants: {
            some: { userId: user.id }
          }
        },
        {
          participants: {
            some: { userId: participantId }
          }
        },
        // If sessionId provided, match specific session conversation
        ...(sessionId ? [{ sessionId }] : [])
      ]
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImageUrl: true
            }
          }
        }
      }
    }
  });

  if (existingConversation) {
    return successResponse(res, { conversation: existingConversation }, 'Conversation already exists');
  }

  // Verify the other participant exists
  const otherUser = await prisma.user.findUnique({
    where: { id: participantId },
    select: { id: true, isActive: true }
  });

  if (!otherUser || !otherUser.isActive) {
    throw new NotFoundError('User not found or inactive');
  }

  // Create conversation with participants
  const conversation = await prisma.conversation.create({
    data: {
      sessionId,
      participants: {
        create: [
          { userId: user.id },
          { userId: participantId }
        ]
      },
      ...(initialMessage && {
        messages: {
          create: {
            senderId: user.id,
            content: initialMessage,
            messageType: 'text'
          }
        }
      })
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImageUrl: true,
              userType: true
            }
          }
        }
      },
      messages: {
        include: {
          sender: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }
    }
  });

  successResponse(res, { conversation }, 'Conversation created successfully', 201);
}));

// GET /api/v1/conversations/:id/messages - Get messages in conversation
router.get('/:id/messages', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const conversationId = req.params.id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = (page - 1) * limit;

  // Verify user is participant in conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        where: { userId: user.id }
      }
    }
  });

  if (!conversation || conversation.participants.length === 0) {
    throw new ValidationError('You are not authorized to view this conversation');
  }

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImageUrl: true
          }
        }
      },
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.message.count({
      where: { conversationId }
    })
  ]);

  // Mark messages as read for this user
  await prisma.messageReadStatus.upsert({
    where: {
      messageId_userId: {
        messageId: messages[0]?.id || '',
        userId: user.id
      }
    },
    update: { readAt: new Date() },
    create: {
      messageId: messages[0]?.id || '',
      userId: user.id,
      readAt: new Date()
    }
  }).catch(() => {
    // Ignore error if no messages exist
  });

  paginatedResponse(res, messages.reverse(), total, page, limit, 'Messages retrieved successfully');
}));

// POST /api/v1/conversations/:id/messages - Send message
router.post('/:id/messages', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const conversationId = req.params.id;
  const { content, messageType, fileUrl } = SendMessageSchema.parse(req.body);

  // Verify user is participant in conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        where: { userId: user.id }
      }
    }
  });

  if (!conversation || conversation.participants.length === 0) {
    throw new ValidationError('You are not authorized to send messages in this conversation');
  }

  // Create message
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: user.id,
      content,
      messageType,
      fileUrl
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

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() }
  });

  // TODO: Send real-time notification via Socket.IO
  // socketIO.to(conversationId).emit('new_message', message);

  successResponse(res, { message }, 'Message sent successfully', 201);
}));

// PUT /api/v1/messages/:id/read - Mark message as read
router.put('/:messageId/read', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const messageId = req.params.messageId;

  // Verify message exists and user has access
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      conversation: {
        include: {
          participants: {
            where: { userId: user.id }
          }
        }
      }
    }
  });

  if (!message || message.conversation.participants.length === 0) {
    throw new ValidationError('Message not found or access denied');
  }

  // Don't mark own messages as read
  if (message.senderId === user.id) {
    return successResponse(res, null, 'Cannot mark own message as read');
  }

  // Mark as read
  const readStatus = await prisma.messageReadStatus.upsert({
    where: {
      messageId_userId: {
        messageId,
        userId: user.id
      }
    },
    update: { readAt: new Date() },
    create: {
      messageId,
      userId: user.id,
      readAt: new Date()
    }
  });

  successResponse(res, { readStatus }, 'Message marked as read');
}));

// GET /api/v1/conversations/:id - Get conversation details
router.get('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const conversationId = req.params.id;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImageUrl: true,
              userType: true
            }
          }
        }
      },
      session: {
        select: {
          id: true,
          scheduledStart: true,
          status: true,
          subject: { select: { name: true } }
        }
      }
    }
  });

  if (!conversation) {
    throw new NotFoundError('Conversation not found');
  }

  // Verify user is participant
  const isParticipant = conversation.participants.some(p => p.userId === user.id);
  if (!isParticipant) {
    throw new ValidationError('You are not authorized to view this conversation');
  }

  // Remove current user from participants list
  const otherParticipants = conversation.participants.filter(p => p.userId !== user.id);

  successResponse(res, { 
    ...conversation, 
    otherParticipants 
  }, 'Conversation details retrieved successfully');
}));

export default router; 