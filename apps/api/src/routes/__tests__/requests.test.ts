import { Request, Response } from 'express';
import { UserType, RequestUrgency, RequestStatus } from '@tutorconnect/database';
import { Decimal } from '@prisma/client/runtime/library';
import request from 'supertest';
import app from '../../app';
import { mockPrisma } from '../../../jest.setup';

// Mock auth middleware
jest.mock('../../utils/supabaseAuth', () => ({
  mockAuth: (req: Request, res: Response, next: Function) => {
    (req as any).user = mockUsers.student;
    next();
  }
}));

// Mock data
const mockUsers = {
  student: {
    id: 'test-student-1',
    email: 'student@test.com',
    userType: UserType.student,
    isActive: true,
    isVerified: true,
    firstName: 'Test',
    lastName: 'Student',
    phone: '+1234567890',
    profileImageUrl: null,
    timezone: 'UTC',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    passwordHash: 'hashed-password'
  },
  tutor: {
    id: 'test-tutor-1',
    email: 'tutor@test.com',
    userType: UserType.tutor,
    isActive: true,
    isVerified: true,
    firstName: 'Test',
    lastName: 'Tutor',
    phone: '+1234567890',
    profileImageUrl: null,
    timezone: 'UTC',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    passwordHash: 'hashed-password'
  }
};

const mockRequest = {
  id: 'request-1',
  tuteeId: mockUsers.student.id,
  subjectId: 'subject-1',
  title: 'Help with Math',
  description: 'Need help with calculus',
  preferredSchedule: 'Weekends',
  budget: new Decimal(50),
  urgency: RequestUrgency.normal,
  status: RequestStatus.open,
  createdAt: new Date(),
  updatedAt: new Date(),
  tutee: {
    user: mockUsers.student
  },
  subject: {
    id: 'subject-1',
    name: 'Mathematics'
  }
};

describe('Tutoring Requests Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/requests', () => {
    it('should return user\'s requests for student', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.student);
      mockPrisma.tutoringRequest.findMany.mockResolvedValue([mockRequest]);
      mockPrisma.tutoringRequest.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/requests')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(mockRequest.id);
      expect(mockPrisma.tutoringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tuteeId: mockUsers.student.id
          })
        })
      );
    });

    it('should return open requests for tutor', async () => {
      const mockTutorUser = { ...mockUsers.tutor };
      mockPrisma.user.findUnique.mockResolvedValue(mockTutorUser);
      mockPrisma.tutoringRequest.findMany.mockResolvedValue([mockRequest]);
      mockPrisma.tutoringRequest.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/requests')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(mockPrisma.tutoringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: RequestStatus.open
          })
        })
      );
    });

    it('should handle pagination', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.student);
      mockPrisma.tutoringRequest.findMany.mockResolvedValue([mockRequest]);
      mockPrisma.tutoringRequest.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/requests?page=2&limit=5')
        .expect(200);

      expect(response.body.pagination).toEqual({
        page: 2,
        limit: 5,
        total: 1,
        totalPages: 1
      });
    });
  });

  describe('GET /api/v1/requests/:id', () => {
    it('should return request details for authorized user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.student);
      mockPrisma.tutoringRequest.findUnique.mockResolvedValue(mockRequest);

      const response = await request(app)
        .get(`/api/v1/requests/${mockRequest.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockRequest.id);
    });

    it('should return 404 for non-existent request', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.student);
      mockPrisma.tutoringRequest.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/requests/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should deny access to unauthorized student', async () => {
      const unauthorizedRequest = {
        ...mockRequest,
        tuteeId: 'other-student'
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.student);
      mockPrisma.tutoringRequest.findUnique.mockResolvedValue(unauthorizedRequest);

      const response = await request(app)
        .get(`/api/v1/requests/${unauthorizedRequest.id}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access denied');
    });
  });

  describe('POST /api/v1/requests', () => {
    const newRequest = {
      subjectId: 'subject-1',
      title: 'New Request',
      description: 'Need help',
      preferredSchedule: 'Weekends',
      budget: '50',
      urgency: RequestUrgency.normal
    };

    it('should create new request for student', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.student);
      mockPrisma.tutoringRequest.create.mockResolvedValue({
        ...mockRequest,
        ...newRequest,
        budget: new Decimal(50),
        status: RequestStatus.open
      });

      const response = await request(app)
        .post('/api/v1/requests')
        .send(newRequest)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(newRequest.title);
      expect(mockPrisma.tutoringRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tuteeId: mockUsers.student.id,
            title: newRequest.title,
            budget: 50,
            urgency: newRequest.urgency,
            status: RequestStatus.open
          })
        })
      );
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/requests')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('required');
    });

    it('should deny access to tutors', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.tutor);

      const response = await request(app)
        .post('/api/v1/requests')
        .send(newRequest)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Only students');
    });
  });

  describe('PUT /api/v1/requests/:id', () => {
    const updateData = {
      title: 'Updated Title',
      description: 'Updated description',
      budget: '60',
      urgency: RequestUrgency.high
    };

    it('should update request for owner', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.student);
      mockPrisma.tutoringRequest.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.tutoringRequest.update.mockResolvedValue({
        ...mockRequest,
        ...updateData,
        budget: new Decimal(60)
      });

      const response = await request(app)
        .put(`/api/v1/requests/${mockRequest.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.budget).toBe('60');
      expect(response.body.data.urgency).toBe(updateData.urgency);
    });

    it('should deny access to non-owner', async () => {
      const otherRequest = {
        ...mockRequest,
        tuteeId: 'other-student'
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.student);
      mockPrisma.tutoringRequest.findUnique.mockResolvedValue(otherRequest);

      const response = await request(app)
        .put(`/api/v1/requests/${otherRequest.id}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access denied');
    });
  });

  describe('DELETE /api/v1/requests/:id', () => {
    it('should delete request for owner', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.student);
      mockPrisma.tutoringRequest.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.tutoringRequest.delete.mockResolvedValue({
        ...mockRequest,
        status: RequestStatus.cancelled
      });

      const response = await request(app)
        .delete(`/api/v1/requests/${mockRequest.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
    });

    it('should deny access to non-owner', async () => {
      const otherRequest = {
        ...mockRequest,
        tuteeId: 'other-student'
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.student);
      mockPrisma.tutoringRequest.findUnique.mockResolvedValue(otherRequest);

      const response = await request(app)
        .delete(`/api/v1/requests/${otherRequest.id}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access denied');
    });

    it('should return 404 for non-existent request', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUsers.student);
      mockPrisma.tutoringRequest.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/v1/requests/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });
}); 