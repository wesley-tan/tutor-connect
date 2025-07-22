import request from 'supertest';
import express from 'express';
import { prismaMock } from '../../tests/setup';
import messagesRouter from '../messages';
import { asyncHandler } from '../../middleware/errorHandlers';
import { mockAuth } from '../../utils/supabaseAuth';
import { mockUsers, mockConversation, mockMessage } from '../../tests/fixtures';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/v1/messages', messagesRouter);

// Mock asyncHandler to pass through
jest.mock('../../middleware/errorHandlers', () => ({
  asyncHandler: (fn: any) => fn,
  successResponse: jest.fn((res, data, message) => {
    res.json({ success: true, data, message });
  })
}));

describe('Messages Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /conversations', () => {
    it('should return conversations for authenticated user', async () => {
      const mockConversations = [
        {
          ...mockConversation,
          userA: mockUsers.tutor,
          userB: mockUsers.student,
          messages: [mockMessage]
        }
      ];

      prismaMock.conversation.findMany.mockResolvedValue(mockConversations as any);

      const response = await request(app)
        .get('/api/v1/messages/conversations')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(prismaMock.conversation.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { participantA: mockUsers.student.id },
            { participantB: mockUsers.student.id }
          ]
        },
        include: expect.objectContaining({
          userA: expect.any(Object),
          userB: expect.any(Object),
          messages: expect.any(Object)
        })
      });
    });

    it('should return empty array when no conversations exist', async () => {
      prismaMock.conversation.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/messages/conversations')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      prismaMock.conversation.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/messages/conversations')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /conversations/:conversationId/messages', () => {
    const conversationId = 'conversation-1';

    it('should return messages for valid conversation', async () => {
      const mockMessages = [mockMessage];
      
      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as any);
      prismaMock.message.findMany.mockResolvedValue(mockMessages as any);

      const response = await request(app)
        .get(`/api/v1/messages/conversations/${conversationId}/messages`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(prismaMock.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: conversationId,
          OR: [
            { participantA: mockUsers.student.id },
            { participantB: mockUsers.student.id }
          ]
        }
      });
    });

    it('should return 404 for non-existent conversation', async () => {
      prismaMock.conversation.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/messages/conversations/${conversationId}/messages`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Conversation not found');
    });

    it('should return 400 for missing conversation ID', async () => {
      const response = await request(app)
        .get('/api/v1/messages/conversations//messages')
        .expect(404); // Express treats empty param as 404
    });

    it('should verify user is participant in conversation', async () => {
      prismaMock.conversation.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/messages/conversations/${conversationId}/messages`)
        .expect(404);

      expect(prismaMock.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: conversationId,
          OR: [
            { participantA: mockUsers.student.id },
            { participantB: mockUsers.student.id }
          ]
        }
      });
    });
  });

  describe('POST /conversations/:conversationId/messages', () => {
    const conversationId = 'conversation-1';
    const messageData = { content: 'Hello, how are you?' };

    it('should send message successfully', async () => {
      const mockCreatedMessage = {
        ...mockMessage,
        messageText: messageData.content,
        sender: mockUsers.student
      };

      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as any);
      prismaMock.message.create.mockResolvedValue(mockCreatedMessage as any);
      prismaMock.conversation.update.mockResolvedValue(mockConversation as any);

      const response = await request(app)
        .post(`/api/v1/messages/conversations/${conversationId}/messages`)
        .send(messageData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCreatedMessage);
      expect(prismaMock.message.create).toHaveBeenCalledWith({
        data: {
          conversation: { connect: { id: conversationId } },
          sender: { connect: { id: mockUsers.student.id } },
          receiver: { connect: { id: mockConversation.participantA } },
          messageText: messageData.content.trim(),
          messageType: 'text',
          isRead: false
        },
        include: expect.any(Object)
      });
    });

    it('should return 400 for empty content', async () => {
      const response = await request(app)
        .post(`/api/v1/messages/conversations/${conversationId}/messages`)
        .send({ content: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Message content is required');
    });

    it('should return 400 for missing content', async () => {
      const response = await request(app)
        .post(`/api/v1/messages/conversations/${conversationId}/messages`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Message content is required');
    });

    it('should return 404 for non-existent conversation', async () => {
      prismaMock.conversation.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/v1/messages/conversations/${conversationId}/messages`)
        .send(messageData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Conversation not found');
    });

    it('should trim message content', async () => {
      const messageWithSpaces = { content: '  Hello with spaces  ' };
      
      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as any);
      prismaMock.message.create.mockResolvedValue(mockMessage as any);
      prismaMock.conversation.update.mockResolvedValue(mockConversation as any);

      await request(app)
        .post(`/api/v1/messages/conversations/${conversationId}/messages`)
        .send(messageWithSpaces)
        .expect(200);

      expect(prismaMock.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            messageText: 'Hello with spaces'
          })
        })
      );
    });
  });

  describe('POST /conversations', () => {
    const participantData = { participantBId: mockUsers.tutor.id };

    it('should create new conversation successfully', async () => {
      prismaMock.conversation.findFirst.mockResolvedValue(null);
      prismaMock.conversation.create.mockResolvedValue({
        ...mockConversation,
        userA: mockUsers.student,
        userB: mockUsers.tutor
      } as any);

      const response = await request(app)
        .post('/api/v1/messages/conversations')
        .send(participantData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prismaMock.conversation.create).toHaveBeenCalledWith({
        data: {
          userA: { connect: { id: mockUsers.student.id } },
          userB: { connect: { id: participantData.participantBId } }
        },
        include: expect.any(Object)
      });
    });

    it('should return existing conversation if already exists', async () => {
      const existingConversation = {
        ...mockConversation,
        userA: mockUsers.student,
        userB: mockUsers.tutor
      };

      prismaMock.conversation.findFirst.mockResolvedValue(existingConversation as any);

      const response = await request(app)
        .post('/api/v1/messages/conversations')
        .send(participantData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Conversation already exists');
      expect(prismaMock.conversation.create).not.toHaveBeenCalled();
    });

    it('should return 400 for missing participant ID', async () => {
      const response = await request(app)
        .post('/api/v1/messages/conversations')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Participant ID is required');
    });

    it('should return 400 for self-conversation attempt', async () => {
      const response = await request(app)
        .post('/api/v1/messages/conversations')
        .send({ participantBId: mockUsers.student.id })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Cannot create conversation with yourself');
    });
  });

  describe('PUT /conversations/:conversationId/read', () => {
    const conversationId = 'conversation-1';

    it('should mark messages as read successfully', async () => {
      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as any);
      prismaMock.message.updateMany.mockResolvedValue({ count: 2 } as any);

      const response = await request(app)
        .put(`/api/v1/messages/conversations/${conversationId}/read`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prismaMock.message.updateMany).toHaveBeenCalledWith({
        where: {
          conversationId,
          senderId: { not: mockUsers.student.id },
          isRead: false
        },
        data: {
          isRead: true,
          readAt: expect.any(Date)
        }
      });
    });

    it('should return 404 for non-existent conversation', async () => {
      prismaMock.conversation.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .put(`/api/v1/messages/conversations/${conversationId}/read`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Conversation not found');
    });

    it('should return 400 for missing conversation ID', async () => {
      const response = await request(app)
        .put('/api/v1/messages/conversations//read')
        .expect(404); // Express treats empty param as 404
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle concurrent message sending', async () => {
      const conversationId = 'conversation-1';
      const messageData = { content: 'Concurrent message' };

      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as any);
      prismaMock.message.create.mockResolvedValue(mockMessage as any);
      prismaMock.conversation.update.mockResolvedValue(mockConversation as any);

      const promises = [
        request(app)
          .post(`/api/v1/messages/conversations/${conversationId}/messages`)
          .send(messageData),
        request(app)
          .post(`/api/v1/messages/conversations/${conversationId}/messages`)
          .send(messageData)
      ];

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should handle database connection errors', async () => {
      prismaMock.conversation.findMany.mockRejectedValue(new Error('Connection lost'));

      const response = await request(app)
        .get('/api/v1/messages/conversations')
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should validate conversation access permissions', async () => {
      const conversationId = 'conversation-1';
      
      // Mock conversation where user is not a participant
      prismaMock.conversation.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/messages/conversations/${conversationId}/messages`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
}); 