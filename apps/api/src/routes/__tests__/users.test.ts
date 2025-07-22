import request from 'supertest';
import express from 'express';
import { prismaMock } from '../../tests/setup';
import usersRouter from '../users';
import { mockUsers, mockTutorProfile, mockTuteeProfile } from '../../tests/fixtures';
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
app.use('/api/users', usersRouter);
app.use(errorHandler);

describe('Users Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/users/profile', () => {
    it('should return user profile', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUsers.student,
        tuteeProfile: mockTuteeProfile,
        tutorProfile: null
      } as any);

      const response = await request(app)
        .get('/api/users/profile')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toMatchObject({
        id: mockUsers.student.id,
        email: mockUsers.student.email,
        firstName: mockUsers.student.firstName
      });
    });

    it('should return 404 for non-existent user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/users/profile')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should update user profile', async () => {
      const updateData = {
        firstName: 'UpdatedName',
        lastName: 'UpdatedLastName',
        phone: '+1234567890'
      };

      prismaMock.user.update.mockResolvedValue({
        ...mockUsers.student,
        ...updateData
      } as any);

      const response = await request(app)
        .put('/api/users/profile')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.firstName).toBe(updateData.firstName);
    });

    it('should validate profile data', async () => {
      const invalidData = {
        phone: 'invalid-phone'
      };

      const response = await request(app)
        .put('/api/users/profile')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/users/account', () => {
    it('should delete user account with valid password', async () => {
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      prismaMock.user.findUnique.mockResolvedValue({
        passwordHash: 'hashed-password'
      } as any);

      prismaMock.user.update.mockResolvedValue({
        ...mockUsers.student,
        isActive: false
      } as any);

      const response = await request(app)
        .delete('/api/users/account')
        .send({ confirmPassword: 'correct-password' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject invalid password', async () => {
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      prismaMock.user.findUnique.mockResolvedValue({
        passwordHash: 'hashed-password'
      } as any);

      const response = await request(app)
        .delete('/api/users/account')
        .send({ confirmPassword: 'wrong-password' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/users/tutee-profile', () => {
    it('should create tutee profile for student', async () => {
      const profileData = {
        gradeLevel: '12th',
        schoolName: 'Test School',
        budgetMax: 50
      };

      prismaMock.tuteeProfile.findUnique.mockResolvedValue(null);
      prismaMock.tuteeProfile.create.mockResolvedValue({
        ...mockTuteeProfile,
        ...profileData
      } as any);

      const response = await request(app)
        .post('/api/users/tutee-profile')
        .send(profileData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.profile.gradeLevel).toBe(profileData.gradeLevel);
    });

    it('should prevent duplicate tutee profile', async () => {
      prismaMock.tuteeProfile.findUnique.mockResolvedValue(mockTuteeProfile as any);

      const response = await request(app)
        .post('/api/users/tutee-profile')
        .send({ gradeLevel: '12th' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('POST /api/users/tutor-profile', () => {
    beforeEach(() => {
      // Mock as tutor user for these tests
      (authenticateToken as jest.Mock).mockImplementation((req, res, next) => {
        req.user = mockUsers.tutor;
        next();
      });
    });

    it('should create tutor profile for tutor', async () => {
      const profileData = {
        hourlyRate: 60,
        bio: 'Experienced tutor',
        teachingExperienceYears: 5
      };

      prismaMock.tutorProfile.findUnique.mockResolvedValue(null);
      prismaMock.tutorProfile.create.mockResolvedValue({
        ...mockTutorProfile,
        ...profileData
      } as any);

      const response = await request(app)
        .post('/api/users/tutor-profile')
        .send(profileData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.profile.hourlyRate).toBe(profileData.hourlyRate);
    });

    it('should validate hourly rate', async () => {
      const response = await request(app)
        .post('/api/users/tutor-profile')
        .send({ hourlyRate: 5 }) // Below minimum
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/users/tutee/recommendations', () => {
    beforeEach(() => {
      // Mock as student user
      (authenticateToken as jest.Mock).mockImplementation((req, res, next) => {
        req.user = mockUsers.student;
        next();
      });
    });

    it('should return tutor recommendations', async () => {
      prismaMock.tuteeProfile.findUnique.mockResolvedValue({
        ...mockTuteeProfile,
        subjectNeeds: [{ subjectId: 'math-1', subject: { name: 'Mathematics' } }]
      } as any);

      prismaMock.tutorProfile.findMany.mockResolvedValue([
        {
          ...mockTutorProfile,
          user: mockUsers.tutor,
          subjects: [{ subjectId: 'math-1', subject: { name: 'Mathematics' } }]
        }
      ] as any);

      const response = await request(app)
        .get('/api/users/tutee/recommendations')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tutors).toHaveLength(1);
    });

    it('should require tutee profile', async () => {
      prismaMock.tuteeProfile.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/users/tutee/recommendations')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/users/tutee/search', () => {
    beforeEach(() => {
      (authenticateToken as jest.Mock).mockImplementation((req, res, next) => {
        req.user = mockUsers.student;
        next();
      });
    });

    it('should search tutors with filters', async () => {
      const searchData = {
        subjects: ['Mathematics'],
        maxHourlyRate: 80,
        minRating: 4.0
      };

      prismaMock.tutorProfile.findMany.mockResolvedValue([
        {
          ...mockTutorProfile,
          user: mockUsers.tutor
        }
      ] as any);
      prismaMock.tutorProfile.count.mockResolvedValue(1);

      const response = await request(app)
        .post('/api/users/tutee/search')
        .send(searchData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tutors).toHaveLength(1);
      expect(response.body.data.pagination).toBeDefined();
    });
  });

  describe('POST /api/users/tutee/goals', () => {
    beforeEach(() => {
      (authenticateToken as jest.Mock).mockImplementation((req, res, next) => {
        req.user = mockUsers.student;
        next();
      });
    });

    it('should update learning goals', async () => {
      const goals = [
        { goalText: 'Improve algebra skills', priority: 1 },
        { goalText: 'Master calculus', priority: 2 }
      ];

      prismaMock.tuteeProfile.findUnique.mockResolvedValue(mockTuteeProfile as any);
      prismaMock.$transaction.mockResolvedValue(undefined);
      prismaMock.tuteeLearningGoal.findMany.mockResolvedValue(goals as any);

      const response = await request(app)
        .post('/api/users/tutee/goals')
        .send({ goals })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.goals).toHaveLength(2);
    });
  });

  describe('POST /api/users/tutee/subjects', () => {
    beforeEach(() => {
      (authenticateToken as jest.Mock).mockImplementation((req, res, next) => {
        req.user = mockUsers.student;
        next();
      });
    });

    it('should update subject needs', async () => {
      const subjects = [
        { subjectId: 'math-1', urgencyLevel: 5 },
        { subjectId: 'physics-1', urgencyLevel: 3 }
      ];

      prismaMock.tuteeProfile.findUnique.mockResolvedValue(mockTuteeProfile as any);
      prismaMock.$transaction.mockResolvedValue(undefined);
      prismaMock.tuteeSubjectNeed.findMany.mockResolvedValue(subjects as any);

      const response = await request(app)
        .post('/api/users/tutee/subjects')
        .send({ subjects })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subjects).toHaveLength(2);
    });
  });
}); 