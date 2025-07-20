import express, { Request, Response } from 'express';
import { prisma } from '@tutorconnect/database';
import { asyncHandler, successResponse, paginatedResponse } from '../middleware/errorHandlers';

const router = express.Router();

// GET /api/v1/subjects - Get available subjects
router.get('/subjects', asyncHandler(async (req: Request, res: Response) => {
  const { category, search, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  // Build where conditions
  const where: any = { isActive: true };

  if (category) {
    where.category = category;
  }

  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } }
    ];
  }

  const [subjects, total] = await Promise.all([
    prisma.subject.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        _count: {
          select: {
            tutorSubjects: true,
            sessions: true
          }
        }
      },
      skip: offset,
      take: parseInt(limit as string),
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    }),
    prisma.subject.count({ where })
  ]);

  // Add popularity metrics
  const subjectsWithMetrics = subjects.map(subject => ({
    ...subject,
    tutorCount: subject._count.tutorSubjects,
    sessionCount: subject._count.sessions,
    popularity: subject._count.tutorSubjects + subject._count.sessions
  }));

  paginatedResponse(
    res, 
    subjectsWithMetrics, 
    total, 
    parseInt(page as string), 
    parseInt(limit as string), 
    'Subjects retrieved successfully'
  );
}));

// GET /api/v1/subjects/categories - Get subject categories
router.get('/subjects/categories', asyncHandler(async (req: Request, res: Response) => {
  const categories = await prisma.subject.groupBy({
    by: ['category'],
    where: { isActive: true },
    _count: { category: true },
    orderBy: { category: 'asc' }
  });

  const formattedCategories = categories.map(cat => ({
    name: cat.category,
    subjectCount: cat._count.category
  }));

  successResponse(res, { categories: formattedCategories }, 'Subject categories retrieved successfully');
}));

// GET /api/v1/subjects/:id - Get subject details
router.get('/subjects/:id', asyncHandler(async (req: Request, res: Response) => {
  const subjectId = req.params.id;

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      _count: {
        select: {
          tutorSubjects: true,
          sessions: true
        }
      }
    }
  });

  if (!subject) {
    return successResponse(res, { subject: null }, 'Subject not found');
  }

  // Get top tutors for this subject
  const topTutors = await prisma.tutorProfile.findMany({
    where: {
      tutorSubjects: {
        some: { subjectId }
      },
      isVerified: true,
      user: { isActive: true }
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          profileImageUrl: true
        }
      },
      tutorSubjects: {
        where: { subjectId },
        select: {
          proficiencyLevel: true,
          yearsExperience: true
        }
      }
    },
    orderBy: [
      { ratingAverage: 'desc' },
      { totalReviews: 'desc' }
    ],
    take: 5
  });

  const subjectWithDetails = {
    ...subject,
    tutorCount: subject._count.tutorSubjects,
    sessionCount: subject._count.sessions,
    topTutors
  };

  successResponse(res, { subject: subjectWithDetails }, 'Subject details retrieved successfully');
}));

// GET /api/v1/certifications - Get available certifications
router.get('/certifications', asyncHandler(async (req: Request, res: Response) => {
  const { category, search, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  // Build where conditions
  const where: any = { isActive: true };

  if (category) {
    where.category = category;
  }

  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } },
      { issuingOrganization: { contains: search as string, mode: 'insensitive' } }
    ];
  }

  const [certifications, total] = await Promise.all([
    prisma.certification.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        issuingOrganization: true,
        validityPeriodMonths: true,
        _count: {
          select: {
            tutorCertifications: true
          }
        }
      },
      skip: offset,
      take: parseInt(limit as string),
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    }),
    prisma.certification.count({ where })
  ]);

  // Add tutor count
  const certificationsWithMetrics = certifications.map(cert => ({
    ...cert,
    tutorCount: cert._count.tutorCertifications
  }));

  paginatedResponse(
    res, 
    certificationsWithMetrics, 
    total, 
    parseInt(page as string), 
    parseInt(limit as string), 
    'Certifications retrieved successfully'
  );
}));

// GET /api/v1/certifications/categories - Get certification categories
router.get('/certifications/categories', asyncHandler(async (req: Request, res: Response) => {
  const categories = await prisma.certification.groupBy({
    by: ['category'],
    where: { isActive: true },
    _count: { category: true },
    orderBy: { category: 'asc' }
  });

  const formattedCategories = categories.map(cat => ({
    name: cat.category,
    certificationCount: cat._count.category
  }));

  successResponse(res, { categories: formattedCategories }, 'Certification categories retrieved successfully');
}));

// GET /api/v1/certifications/:id - Get certification details
router.get('/certifications/:id', asyncHandler(async (req: Request, res: Response) => {
  const certificationId = req.params.id;

  const certification = await prisma.certification.findUnique({
    where: { id: certificationId },
    include: {
      _count: {
        select: {
          tutorCertifications: true
        }
      }
    }
  });

  if (!certification) {
    return successResponse(res, { certification: null }, 'Certification not found');
  }

  // Get tutors with this certification
  const tutorsWithCert = await prisma.tutorProfile.findMany({
    where: {
      tutorCertifications: {
        some: { certificationId }
      },
      isVerified: true,
      user: { isActive: true }
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          profileImageUrl: true
        }
      },
      tutorCertifications: {
        where: { certificationId },
        select: {
          earnedDate: true,
          expiryDate: true,
          credentialUrl: true
        }
      }
    },
    orderBy: [
      { ratingAverage: 'desc' },
      { totalReviews: 'desc' }
    ],
    take: 10
  });

  const certificationWithDetails = {
    ...certification,
    tutorCount: certification._count.tutorCertifications,
    tutorsWithCertification: tutorsWithCert
  };

  successResponse(res, { certification: certificationWithDetails }, 'Certification details retrieved successfully');
}));

// GET /api/v1/languages - Get available languages
router.get('/languages', asyncHandler(async (req: Request, res: Response) => {
  const languages = await prisma.tutorLanguage.groupBy({
    by: ['languageCode', 'languageName'],
    _count: { languageCode: true },
    orderBy: [
      { _count: { languageCode: 'desc' } },
      { languageName: 'asc' }
    ]
  });

  const formattedLanguages = languages.map(lang => ({
    code: lang.languageCode,
    name: lang.languageName,
    tutorCount: lang._count.languageCode
  }));

  successResponse(res, { languages: formattedLanguages }, 'Languages retrieved successfully');
}));

// GET /api/v1/specializations - Get available specializations
router.get('/specializations', asyncHandler(async (req: Request, res: Response) => {
  const { category, search } = req.query;

  // Build where conditions
  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } }
    ];
  }

  const specializations = await prisma.tutorSpecialization.groupBy({
    by: ['name', 'description'],
    where,
    _count: { name: true },
    orderBy: [
      { _count: { name: 'desc' } },
      { name: 'asc' }
    ]
  });

  const formattedSpecializations = specializations.map(spec => ({
    name: spec.name,
    description: spec.description,
    tutorCount: spec._count.name
  }));

  successResponse(res, { specializations: formattedSpecializations }, 'Specializations retrieved successfully');
}));

// GET /api/v1/grade-levels - Get available grade levels
router.get('/grade-levels', asyncHandler(async (req: Request, res: Response) => {
  const gradeLevels = await prisma.tuteeProfile.groupBy({
    by: ['gradeLevel'],
    where: {
      gradeLevel: { not: null },
      user: { isActive: true }
    },
    _count: { gradeLevel: true },
    orderBy: { gradeLevel: 'asc' }
  });

  const formattedGradeLevels = gradeLevels
    .filter(gl => gl.gradeLevel)
    .map(gl => ({
      level: gl.gradeLevel,
      studentCount: gl._count.gradeLevel
    }));

  successResponse(res, { gradeLevels: formattedGradeLevels }, 'Grade levels retrieved successfully');
}));

// GET /api/v1/search-suggestions - Get search suggestions
router.get('/search-suggestions', asyncHandler(async (req: Request, res: Response) => {
  const { query, type = 'all' } = req.query;

  if (!query || (query as string).length < 2) {
    return successResponse(res, { suggestions: [] }, 'Query too short');
  }

  const searchTerm = query as string;
  const suggestions: any[] = [];

  // Search subjects
  if (type === 'all' || type === 'subjects') {
    const subjectMatches = await prisma.subject.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      select: { id: true, name: true, category: true },
      take: 5
    });

    suggestions.push(...subjectMatches.map(s => ({
      type: 'subject',
      id: s.id,
      name: s.name,
      category: s.category
    })));
  }

  // Search tutors
  if (type === 'all' || type === 'tutors') {
    const tutorMatches = await prisma.user.findMany({
      where: {
        isActive: true,
        userType: 'tutor',
        OR: [
          { firstName: { contains: searchTerm, mode: 'insensitive' } },
          { lastName: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      select: { 
        id: true, 
        firstName: true, 
        lastName: true,
        tutorProfile: {
          select: { id: true, ratingAverage: true }
        }
      },
      take: 5
    });

    suggestions.push(...tutorMatches
      .filter(t => t.tutorProfile)
      .map(t => ({
        type: 'tutor',
        id: t.tutorProfile!.id,
        name: `${t.firstName} ${t.lastName}`,
        rating: t.tutorProfile!.ratingAverage
      })));
  }

  // Search certifications
  if (type === 'all' || type === 'certifications') {
    const certMatches = await prisma.certification.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { issuingOrganization: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      select: { id: true, name: true, issuingOrganization: true },
      take: 3
    });

    suggestions.push(...certMatches.map(c => ({
      type: 'certification',
      id: c.id,
      name: c.name,
      organization: c.issuingOrganization
    })));
  }

  successResponse(res, { suggestions }, 'Search suggestions retrieved successfully');
}));

export default router; 