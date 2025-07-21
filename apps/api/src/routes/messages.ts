import { Router } from 'express';
import { prisma } from '@tutorconnect/database';
import { logger } from '../utils/logger';
import { verifySupabaseToken, AuthenticatedRequest } from '../utils/supabaseAuth';

const router = Router();

// Get all conversations for the authenticated user
router.get('/conversations', verifySupabaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user.id;
    
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { participantA: userId },
          { participantB: userId }
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
      },
      orderBy: {
        lastMessageAt: 'desc'
      }
    });

    // Transform conversations to show the other participant
    const transformedConversations = conversations.map(conv => {
      const otherParticipant = conv.participantA === userId 
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

    res.json({
      success: true,
      data: transformedConversations
    });
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations'
    });
  }
});

// Get messages for a specific conversation
router.get('/conversations/:conversationId/messages', verifySupabaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Verify user is part of this conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { participantA: userId },
          { participantB: userId }
        ]
      }
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
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
});

// Send a new message
router.post('/conversations/:conversationId/messages', verifySupabaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;
    const senderId = req.user.id;

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
          { participantA: senderId },
          { participantB: senderId }
        ]
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Determine receiver ID
    const receiverId = conversation.participantA === senderId 
      ? conversation.participantB 
      : conversation.participantA;

    // Create the message
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId,
        receiverId,
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
      where: { id: conversationId },
      data: { lastMessageAt: new Date() }
    });

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

// Create a new conversation
router.post('/conversations', verifySupabaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { participantBId } = req.body;
    const participantAId = req.user.id;

    if (!participantBId) {
      return res.status(400).json({
        success: false,
        message: 'Participant ID is required'
      });
    }

    if (participantAId === participantBId) {
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
            participantA: participantAId,
            participantB: participantBId
          },
          {
            participantA: participantBId,
            participantB: participantAId
          }
        ]
      }
    });

    if (existingConversation) {
      return res.json({
        success: true,
        data: existingConversation
      });
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        participantA: participantAId,
        participantB: participantBId
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

    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    logger.error('Error creating conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create conversation'
    });
  }
});

// Mark messages as read
router.put('/conversations/:conversationId/read', verifySupabaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Verify user is part of this conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { participantA: userId },
          { participantB: userId }
        ]
      }
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
        senderId: { not: userId },
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    logger.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read'
    });
  }
});

export default router; 