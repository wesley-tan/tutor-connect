const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3006;

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005',
    'http://localhost:3006'
  ],
  credentials: true
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: 'development',
    version: '1.0.0',
    database: 'connected',
    redis: 'connected'
  });
});

// Mock API endpoints
app.get('/api/v1/conversations', (req, res) => {
  console.log('📨 GET /api/v1/conversations');
  res.json({
    success: true,
    data: [
      {
        id: '1',
        participantA: 'user1',
        participantB: 'user2',
        lastMessageAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        participantAUser: {
          id: 'user1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          profileImageUrl: null
        },
        participantBUser: {
          id: 'user2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          profileImageUrl: null
        },
        lastMessage: {
          id: 'msg1',
          messageText: 'Hello! How can I help you?',
          createdAt: new Date().toISOString(),
          senderId: 'user2'
        }
      }
    ]
  });
});

app.get('/api/v1/sessions', (req, res) => {
  console.log('📅 GET /api/v1/sessions');
  res.json({
    success: true,
    data: [
      {
        id: '1',
        tuteeId: 'user1',
        tutorId: 'user2',
        subjectId: 'math',
        statusId: 1,
        scheduledStart: new Date(Date.now() + 86400000).toISOString(),
        scheduledEnd: new Date(Date.now() + 86400000 + 3600000).toISOString(),
        sessionType: 'online',
        zoomMeetingId: '123456789',
        zoomJoinUrl: 'https://zoom.us/j/123456789',
        zoomPassword: 'password123',
        sessionNotes: 'First session',
        homeworkAssigned: 'Practice problems 1-10',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  });
});

app.get('/api/v1/requests', (req, res) => {
  console.log('📝 GET /api/v1/requests');
  res.json({
    success: true,
    data: [
      {
        id: '1',
        tuteeId: 'user1',
        subjectId: 'math',
        title: 'Need help with calculus',
        description: 'I need help understanding derivatives and integrals',
        preferredSchedule: 'Weekdays after 6 PM',
        budget: 50,
        urgency: 'normal',
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tutee: {
          id: 'user1',
          user: {
            id: 'user1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            profileImageUrl: null
          }
        },
        subject: {
          id: 'math',
          name: 'Mathematics',
          description: 'All math subjects'
        }
      }
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ API Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log('❌ 404 Not Found:', req.originalUrl);
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Simple API server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 API endpoints: http://localhost:${PORT}/api/v1/`);
  console.log(`📨 Conversations: http://localhost:${PORT}/api/v1/conversations`);
  console.log(`📅 Sessions: http://localhost:${PORT}/api/v1/sessions`);
  console.log(`📝 Requests: http://localhost:${PORT}/api/v1/requests`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
}); 