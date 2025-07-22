import { Router, Response, Request } from 'express';
import { prisma } from '@tutorconnect/database';
import { logger } from '../utils/logger';
import { mockAuth, AuthenticatedRequest } from '../utils/supabaseAuth';
import { Prisma } from '@tutorconnect/database';
import { asyncHandler, successResponse } from '../middleware/errorHandlers';

const router = Router();

// Get all conversations for the authenticated user
router.get('/conversations', mockAuth, asyncHandler(async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [
        { participantA: user.id },
        { participantB: user.id }
      ]
    } as Prisma.ConversationWhereInput,
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
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 1
      }
    }
  });

  // Transform conversations to show the other participant
  const transformedConversations = conversations.map(conv => {
    const otherParticipant = conv.participantA === user.id 
      ? conv.userB 
      : conv.userA;
    
    const lastMessage = conv.messages[0] || null;
    
    return {
      id: conv.id,
      otherParticipant,
      lastMessage,
      lastMessageAt: conv.lastMessageAt,
      unreadCount: 0 // TODO: Implement unread count
    };
  });

  successResponse(res, transformedConversations, 'Conversations retrieved successfully');
}));

// Get messages for a specific conversation
router.get('/conversations/:conversationId/messages', mockAuth, asyncHandler(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { user } = req as AuthenticatedRequest;

  if (!conversationId) {
    return res.status(400).json({
      success: false,
      message: 'Conversation ID is required'
    });
  }

  // Verify user is part of this conversation
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
    return res.status(404).json({
      success: false,
      message: 'Conversation not found'
    });
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId
    } as Prisma.MessageWhereInput,
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
    orderBy: {
      createdAt: 'asc'
    }
  });

  return successResponse(res, messages, 'Messages retrieved successfully');
}));

// Send a new message
router.post('/conversations/:conversationId/messages', mockAuth, asyncHandler(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { content } = req.body;
  const { user } = req as AuthenticatedRequest;

  if (!conversationId) {
    return res.status(400).json({
      success: false,
      message: 'Conversation ID is required'
    });
  }

  if (!content || content.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message content is required'
    });
  }

  // Verify user is part of this conversation
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
    return res.status(404).json({
      success: false,
      message: 'Conversation not found'
    });
  }

  // Determine receiver ID
  const receiverId = conversation.participantA === user.id 
    ? conversation.participantB 
    : conversation.participantA;

  // Create the message
  const message = await prisma.message.create({
    data: {
      conversation: { connect: { id: conversationId } },
      sender: { connect: { id: user.id } },
      receiver: { connect: { id: receiverId } },
      messageText: content.trim(),
      messageType: 'text',
      isRead: false
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

  // Update conversation's lastMessageAt
  await prisma.conversation.update({
    where: { id: conversationId } as Prisma.ConversationWhereUniqueInput,
    data: { lastMessageAt: new Date() }
  });

  return successResponse(res, message, 'Message sent successfully');
}));

// Create a new conversation
router.post('/conversations', mockAuth, asyncHandler(async (req: Request, res: Response) => {
  const { participantBId } = req.body;
  const { user } = req as AuthenticatedRequest;

  if (!participantBId) {
    return res.status(400).json({
      success: false,
      message: 'Participant ID is required'
    });
  }

  if (user.id === participantBId) {
    return res.status(400).json({
      success: false,
      message: 'Cannot create conversation with yourself'
    });
  }

  // Check if conversation already exists
  const existingConversation = await prisma.conversation.findFirst({
    where: {
      OR: [
        {
          participantA: user.id,
          participantB: participantBId
        },
        {
          participantA: participantBId,
          participantB: user.id
        }
      ]
    } as Prisma.ConversationWhereInput
  });

  if (existingConversation) {
    return successResponse(res, existingConversation, 'Conversation already exists');
  }

  // Create new conversation
  const conversation = await prisma.conversation.create({
    data: {
      userA: { connect: { id: user.id } },
      userB: { connect: { id: participantBId } }
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
      }
    }
  });

  return successResponse(res, conversation, 'Conversation created successfully');
}));

// Mark messages as read
router.put('/conversations/:conversationId/read', mockAuth, asyncHandler(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { user } = req as AuthenticatedRequest;

  if (!conversationId) {
    return res.status(400).json({
      success: false,
      message: 'Conversation ID is required'
    });
  }

  // Verify user is part of this conversation
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
    return res.status(404).json({
      success: false,
      message: 'Conversation not found'
    });
  }

  // Mark all unread messages as read
  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: user.id },
      isRead: false
    } as Prisma.MessageWhereInput,
    data: {
      isRead: true,
      readAt: new Date()
    }
  });

  return successResponse(res, null, 'Messages marked as read');
}));

export default router; 