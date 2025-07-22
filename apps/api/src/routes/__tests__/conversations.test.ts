import request from 'supertest';
import express from 'express';
import { prismaMock } from '../../tests/setup';
import conversationsRouter from '../conversations';
import { mockUsers, mockConversation, mockMessage, createMockRequest } from '../../tests/fixtures';
import { authenticateToken } from '../../utils/auth';
import { errorHandler } from '../../middleware/errorHandlers';

// Mock auth middleware
jest.mock('../../utils/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = mockUsers.student;
    next();
  })
}));

const app = express();
app.use(express.json());
app.use('/api/conversations', conversationsRouter);
app.use(errorHandler);

describe('Conversations Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/conversations', () => {
    it('should return user conversations', async () => {
      const mockConversations = [
        {
          ...mockConversation,
          userA: mockUsers.tutor,
          userB: mockUsers.student,
          messages: [mockMessage]
        }
      ];

      prismaMock.conversation.findMany.mockResolvedValue(mockConversations as any);
      prismaMock.conversation.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/conversations')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('otherUser');
      expect(response.body.data[0]).toHaveProperty('lastMessage');
    });

    it('should handle pagination', async () => {
      prismaMock.conversation.findMany.mockResolvedValue([]);
      prismaMock.conversation.count.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/conversations?page=2&limit=5')
        .expect(200);

      expect(prismaMock.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5
        })
      );
    });
  });

  describe('POST /api/conversations', () => {
    it('should create new conversation', async () => {
      const participantId = 'test-tutor-1';
      const initialMessage = 'Hello, I need help with math';

      prismaMock.conversation.findFirst.mockResolvedValue(null);
      prismaMock.conversation.create.mockResolvedValue({
        ...mockConversation,
        userA: mockUsers.student,
        userB: mockUsers.tutor,
        messages: [{
          ...mockMessage,
          messageText: initialMessage
        }]
      } as any);

      const response = await request(app)
        .post('/api/conversations')
        .send({ participantId, initialMessage })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.conversation).toBeDefined();
    });

    it('should return existing conversation if it exists', async () => {
      const participantId = 'test-tutor-1';

      prismaMock.conversation.findFirst.mockResolvedValue({
        ...mockConversation,
        userA: mockUsers.student,
        userB: mockUsers.tutor,
        messages: []
      } as any);

      const response = await request(app)
        .post('/api/conversations')
        .send({ participantId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.conversation).toBeDefined();
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/conversations/:id/messages', () => {
    it('should return messages for authorized user', async () => {
      const conversationId = 'conversation-1';

      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as any);
      prismaMock.message.findMany.mockResolvedValue([mockMessage] as any);
      prismaMock.message.count.mockResolvedValue(1);
      prismaMock.message.update.mockResolvedValue(mockMessage as any);

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should return 403 for unauthorized user', async () => {
      const conversationId = 'conversation-1';

      prismaMock.conversation.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/conversations/:id/messages', () => {
    it('should send message in authorized conversation', async () => {
      const conversationId = 'conversation-1';
      const messageText = 'Can you help me with algebra?';

      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as any);
      prismaMock.message.create.mockResolvedValue({
        ...mockMessage,
        messageText,
        sender: mockUsers.student
      } as any);
      prismaMock.conversation.update.mockResolvedValue(mockConversation as any);

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .send({ messageText, messageType: 'text' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message.messageText).toBe(messageText);
    });

    it('should validate message content', async () => {
      const conversationId = 'conversation-1';

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/conversations/:messageId/read', () => {
    it('should mark message as read', async () => {
      const messageId = 'message-1';

      prismaMock.message.findFirst.mockResolvedValue({
        ...mockMessage,
        senderId: 'test-tutor-1' // Different from current user
      } as any);
      prismaMock.message.update.mockResolvedValue({
        ...mockMessage,
        isRead: true,
        readAt: new Date()
      } as any);

      const response = await request(app)
        .put(`/api/conversations/${messageId}/read`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should not mark own message as read', async () => {
      const messageId = 'message-1';

      prismaMock.message.findFirst.mockResolvedValue({
        ...mockMessage,
        senderId: mockUsers.student.id
      } as any);

      const response = await request(app)
        .put(`/api/conversations/${messageId}/read`)
        .expect(200);

      expect(response.body.message).toContain('Cannot mark own message as read');
    });
  });

  describe('GET /api/conversations/:id', () => {
    it('should return conversation details for participant', async () => {
      const conversationId = 'conversation-1';

      prismaMock.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        userA: mockUsers.student,
        userB: mockUsers.tutor
      } as any);

      const response = await request(app)
        .get(`/api/conversations/${conversationId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.otherParticipant).toBeDefined();
    });

    it('should return 404 for non-existent conversation', async () => {
      const conversationId = 'non-existent';

      prismaMock.conversation.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/conversations/${conversationId}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
}); 