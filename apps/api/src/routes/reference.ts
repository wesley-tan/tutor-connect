import express, { Request, Response } from 'express';
import { asyncHandler, successResponse } from '../middleware/errorHandlers';

const router = express.Router();

// Simplified reference routes for demo mode

// GET /api/v1/subjects - Get all subjects (demo)
router.get('/subjects', asyncHandler(async (req: Request, res: Response) => {
  const demoSubjects = [
    { id: '1', name: 'Mathematics', category: 'STEM', description: 'Basic to advanced mathematics' },
    { id: '2', name: 'Physics', category: 'STEM', description: 'Physics concepts and applications' },
    { id: '3', name: 'Chemistry', category: 'STEM', description: 'Chemistry fundamentals' },
    { id: '4', name: 'English', category: 'Language Arts', description: 'English language and literature' },
    { id: '5', name: 'History', category: 'Social Studies', description: 'World and regional history' }
  ];

  successResponse(res, { 
    data: demoSubjects,
    total: demoSubjects.length
  }, 'Subjects retrieved successfully (demo mode)');
}));

// GET /api/v1/certifications - Get all certifications (demo)
router.get('/certifications', asyncHandler(async (req: Request, res: Response) => {
  const demoCertifications = [
    { id: '1', name: 'Teaching Certificate', issuingOrganization: 'State Board', description: 'Basic teaching qualification' },
    { id: '2', name: 'Subject Matter Expert', issuingOrganization: 'Education Authority', description: 'Subject expertise certification' },
    { id: '3', name: 'Tutoring Excellence', issuingOrganization: 'Tutoring Association', description: 'Excellence in tutoring practices' }
  ];

  successResponse(res, { 
    data: demoCertifications,
    total: demoCertifications.length
  }, 'Certifications retrieved successfully (demo mode)');
}));

// GET /api/v1/languages - Get all languages (demo)
router.get('/languages', asyncHandler(async (req: Request, res: Response) => {
  const demoLanguages = [
    { id: '1', name: 'English', code: 'en' },
    { id: '2', name: 'Spanish', code: 'es' },
    { id: '3', name: 'French', code: 'fr' },
    { id: '4', name: 'Mandarin', code: 'zh' },
    { id: '5', name: 'German', code: 'de' }
  ];

  successResponse(res, { 
    data: demoLanguages,
    total: demoLanguages.length
  }, 'Languages retrieved successfully (demo mode)');
}));

// GET /api/v1/specializations - Get all specializations (demo)
router.get('/specializations', asyncHandler(async (req: Request, res: Response) => {
  const demoSpecializations = [
    { id: '1', name: 'AP Test Prep', description: 'Advanced Placement test preparation' },
    { id: '2', name: 'SAT Prep', description: 'SAT test preparation and strategy' },
    { id: '3', name: 'IB Program', description: 'International Baccalaureate program support' },
    { id: '4', name: 'Homework Help', description: 'General homework assistance' },
    { id: '5', name: 'Exam Preparation', description: 'Comprehensive exam preparation' }
  ];

  successResponse(res, { 
    data: demoSpecializations,
    total: demoSpecializations.length
  }, 'Specializations retrieved successfully (demo mode)');
}));

export default router; 