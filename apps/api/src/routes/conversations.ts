import express, { Request, Response } from 'express';
import { prisma } from '@tutorconnect/database';
import { asyncHandler, successResponse, ValidationError } from '../middleware/errorHandlers';
import { mockAuth, AuthenticatedRequest } from '../utils/supabaseAuth';
import { z } from 'zod';
import { ParamsDictionary } from 'express-serve-static-core';
import { Prisma } from '@tutorconnect/database';
import { logger } from '../utils/logger';

const router = express.Router();

// Validation schemas
const SendMessageSchema = z.object({
  messageText: z.string().min(1).max(2000),
  messageType: z.enum(['text', 'image', 'file']).default('text'),
  fileUrl: z.string().url().optional()
});

const CreateConversationSchema = z.object({
  participantId: z.string(),
  initialMessage: z.string().min(1).max(2000).optional()
});

// Add type for request params
interface ConversationParams extends ParamsDictionary {
  id: string;
}

interface MessageParams extends ParamsDictionary {
  messageId: string;
}

interface AuthenticatedRequestWithParams<T extends ParamsDictionary> extends AuthenticatedRequest {
  params: T;
}

// GET /api/v1/conversations - Get user's conversations
router.get('/', mockAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    // Get conversations where user is either participant
    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where: {
          OR: [
            { participantA: user.id },
            { participantB: user.id }
          ]
        },
        include: {
          userA: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profileImageUrl: true
            }
          },
          userB: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profileImageUrl: true
            }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.conversation.count({
        where: {
          OR: [
            { participantA: user.id },
            { participantB: user.id }
          ]
        }
      })
    ]);

    // Transform conversations to show the other participant
    const transformedConversations = conversations.map(conv => {
      const otherParticipant = conv.participantA === user.id 
        ? conv.userB 
        : conv.userA;
      
      const lastMessage = conv.messages[0];
      
      return {
        id: conv.id,
        participantA: conv.participantA,
        participantB: conv.participantB,
        lastMessageAt: conv.lastMessageAt,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        participantAUser: conv.userA,
        participantBUser: conv.userB,
        otherParticipant,
        lastMessage
      };
    });
    
    return successResponse(res, {
      data: transformedConversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, 'Conversations retrieved successfully');
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    return successResponse(res, {
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
      }
    }, 'No conversations found');
  }
}));

// POST /api/v1/conversations - Create new conversation
router.post('/', mockAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { user } = req;
  const { participantId, initialMessage } = CreateConversationSchema.parse(req.body);

  // Check if conversation already exists
  const existingConversation = await prisma.conversation.findFirst({
    where: {
      OR: [
        {
          AND: [
            { participantA: user.id },
            { participantB: participantId }
          ]
        },
        {
          AND: [
            { participantA: participantId },
            { participantB: user.id }
          ]
        }
      ]
    } as Prisma.ConversationWhereInput,
    include: {
      userA: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImageUrl: true
        }
      },
      userB: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImageUrl: true
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

  if (existingConversation) {
    return successResponse(res, { conversation: existingConversation }, 'Conversation already exists');
  }

  // Create new conversation
  const conversation = await prisma.conversation.create({
    data: {
      participantA: user.id,
      participantB: participantId,
      ...(initialMessage && {
        messages: {
          create: {
            senderId: user.id,
            receiverId: participantId,
            messageText: initialMessage,
            messageType: 'text'
          }
        }
      })
    },
    include: {
      userA: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImageUrl: true
        }
      },
      userB: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImageUrl: true
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

  return successResponse(res, { conversation }, 'Conversation created successfully', 201);
}));

// POST /api/v1/conversations/:id/messages - Send message
router.post('/:id/messages', mockAuth, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const conversationId = req.params.id;
    if (!conversationId) {
      throw new ValidationError('Conversation ID is required');
    }

    const { messageText, messageType = 'text', fileUrl } = SendMessageSchema.parse(req.body);

    // Verify conversation exists and user is a participant
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { participantA: user.id },
          { participantB: user.id }
        ]
      } as Prisma.ConversationWhereInput
    });

    if (!conversation) {
      throw new ValidationError('Conversation not found or access denied');
    }

    // Determine receiver ID (the other participant)
    const receiverId = conversation.participantA === user.id 
      ? conversation.participantB 
      : conversation.participantA;

    // Create the message in the database
    const newMessage = await prisma.message.create({
      data: {
        conversation: { connect: { id: conversationId } },
        sender: { connect: { id: user.id } },
        receiver: { connect: { id: receiverId } },
        messageText,
        messageType,
        fileUrl,
        isRead: false
      } as Prisma.MessageCreateInput,
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profileImageUrl: true
          }
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profileImageUrl: true
          }
        }
      }
    });

    // Update conversation's lastMessageAt
    await prisma.conversation.update({
      where: { id: conversationId } as Prisma.ConversationWhereUniqueInput,
      data: { 
        lastMessageAt: new Date(),
        updatedAt: new Date()
      }
    });

    return successResponse(res, { 
      message: newMessage 
    }, 'Message sent successfully', 201);
  } catch (error) {
    logger.error('Error sending message:', error);
    return successResponse(res, {
      message: null,
      error: 'Failed to send message'
    }, 'Failed to send message', 500);
  }
}));

// GET /api/v1/conversations/:id/messages - Get messages in conversation
router.get('/:id/messages', mockAuth, asyncHandler(async (req: AuthenticatedRequestWithParams<ConversationParams>, res: Response) => {
  try {
    const { id: conversationId } = req.params;
    const { user } = req;

    if (!conversationId) {
      throw new ValidationError('Conversation ID is required');
    }
    
    // Verify conversation exists and user is a participant
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { participantA: user.id },
          { participantB: user.id }
        ]
      } as Prisma.ConversationWhereInput
    });

    if (!conversation) {
      throw new ValidationError('Conversation not found or access denied');
    }

    // Get messages with pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId } as Prisma.MessageWhereInput,
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profileImageUrl: true
            }
          },
          receiver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profileImageUrl: true
            }
          }
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit
      }),
      prisma.message.count({
        where: { conversationId } as Prisma.MessageWhereInput
      })
    ]);

    return successResponse(res, {
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, 'Messages retrieved successfully');
  } catch (error) {
    logger.error('Error fetching messages:', error);
    return successResponse(res, {
      data: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0
      }
    }, 'No messages found');
  }
}));

// PUT /api/v1/messages/:messageId/read - Mark message as read
router.put('/:messageId/read', mockAuth, asyncHandler(async (req: AuthenticatedRequestWithParams<MessageParams>, res: Response) => {
  const { user } = req;
  const { messageId } = req.params;

  // Verify message exists and user has access
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      conversation: {
        OR: [
          { participantA: user.id },
          { participantB: user.id }
        ]
      }
    } as Prisma.MessageWhereInput
  });

  if (!message) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Message not found or access denied'
      }
    });
  }

  // Don't mark own messages as read
  if (message.senderId === user.id) {
    return successResponse(res, null, 'Cannot mark own message as read');
  }

  // Mark as read
  const updatedMessage = await prisma.message.update({
    where: { id: messageId },
    data: { 
      isRead: true,
      readAt: new Date()
    }
  });

  return successResponse(res, { message: updatedMessage }, 'Message marked as read');
}));

// GET /api/v1/conversations/:id - Get conversation details
router.get('/:id', mockAuth, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const conversationId = req.params.id;

  if (!conversationId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Conversation ID is required'
      }
    });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      userA: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImageUrl: true,
          userType: true
        }
      },
      userB: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImageUrl: true,
          userType: true
        }
      }
    }
  });

  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Conversation not found'
      }
    });
  }

  // Verify user is participant
  const isParticipant = conversation.participantA === user.id || conversation.participantB === user.id;
  if (!isParticipant) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'You are not authorized to view this conversation'
      }
    });
  }

  // Get other participant
  const otherParticipant = conversation.participantA === user.id 
    ? conversation.userB 
    : conversation.userA;

  return successResponse(res, { 
    ...conversation, 
    otherParticipant 
  }, 'Conversation details retrieved successfully');
}));

export default router; 