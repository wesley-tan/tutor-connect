import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create session statuses
  console.log('Creating session statuses...');
  const sessionStatuses = await Promise.all([
    prisma.sessionStatus.upsert({
      where: { name: 'scheduled' },
      update: {},
      create: {
        name: 'scheduled',
        description: 'Session is scheduled and confirmed',
      },
    }),
    prisma.sessionStatus.upsert({
      where: { name: 'in_progress' },
      update: {},
      create: {
        name: 'in_progress',
        description: 'Session is currently happening',
      },
    }),
    prisma.sessionStatus.upsert({
      where: { name: 'completed' },
      update: {},
      create: {
        name: 'completed',
        description: 'Session finished successfully',
      },
    }),
    prisma.sessionStatus.upsert({
      where: { name: 'cancelled' },
      update: {},
      create: {
        name: 'cancelled',
        description: 'Session was cancelled by tutor or tutee',
      },
    }),
    prisma.sessionStatus.upsert({
      where: { name: 'no_show' },
      update: {},
      create: {
        name: 'no_show',
        description: 'Tutee did not attend the session',
      },
    }),
  ]);

  // Create payment statuses
  console.log('Creating payment statuses...');
  const paymentStatuses = await Promise.all([
    prisma.paymentStatus.upsert({
      where: { name: 'pending' },
      update: {},
      create: {
        name: 'pending',
        description: 'Payment is being processed',
      },
    }),
    prisma.paymentStatus.upsert({
      where: { name: 'succeeded' },
      update: {},
      create: {
        name: 'succeeded',
        description: 'Payment was successful',
      },
    }),
    prisma.paymentStatus.upsert({
      where: { name: 'failed' },
      update: {},
      create: {
        name: 'failed',
        description: 'Payment failed',
      },
    }),
    prisma.paymentStatus.upsert({
      where: { name: 'cancelled' },
      update: {},
      create: {
        name: 'cancelled',
        description: 'Payment was cancelled',
      },
    }),
    prisma.paymentStatus.upsert({
      where: { name: 'refunded' },
      update: {},
      create: {
        name: 'refunded',
        description: 'Payment was refunded',
      },
    }),
  ]);

  // Create subjects
  console.log('Creating subjects...');
  const subjects = await Promise.all([
    // SAT subjects
    prisma.subject.upsert({
      where: { name: 'SAT Math' },
      update: {},
      create: {
        name: 'SAT Math',
        category: 'SAT',
        description: 'SAT Mathematics section preparation including algebra, geometry, and data analysis',
      },
    }),
    prisma.subject.upsert({
      where: { name: 'SAT Reading & Writing' },
      update: {},
      create: {
        name: 'SAT Reading & Writing',
        category: 'SAT',
        description: 'SAT Evidence-Based Reading and Writing section',
      },
    }),
    
    // ACT subjects
    prisma.subject.upsert({
      where: { name: 'ACT Math' },
      update: {},
      create: {
        name: 'ACT Math',
        category: 'ACT',
        description: 'ACT Mathematics section covering algebra, geometry, and trigonometry',
      },
    }),
    prisma.subject.upsert({
      where: { name: 'ACT English' },
      update: {},
      create: {
        name: 'ACT English',
        category: 'ACT',
        description: 'ACT English section focusing on grammar, usage, and rhetoric',
      },
    }),
    prisma.subject.upsert({
      where: { name: 'ACT Science' },
      update: {},
      create: {
        name: 'ACT Science',
        category: 'ACT',
        description: 'ACT Science section emphasizing scientific reasoning and data analysis',
      },
    }),
    prisma.subject.upsert({
      where: { name: 'ACT Reading' },
      update: {},
      create: {
        name: 'ACT Reading',
        category: 'ACT',
        description: 'ACT Reading section with comprehension and analysis skills',
      },
    }),
    
    // AP subjects
    prisma.subject.upsert({
      where: { name: 'AP Calculus AB' },
      update: {},
      create: {
        name: 'AP Calculus AB',
        category: 'AP',
        description: 'Advanced Placement Calculus AB covering limits, derivatives, and integrals',
      },
    }),
    prisma.subject.upsert({
      where: { name: 'AP Calculus BC' },
      update: {},
      create: {
        name: 'AP Calculus BC',
        category: 'AP',
        description: 'Advanced Placement Calculus BC including series and advanced integration',
      },
    }),
    prisma.subject.upsert({
      where: { name: 'AP Chemistry' },
      update: {},
      create: {
        name: 'AP Chemistry',
        category: 'AP',
        description: 'Advanced Placement Chemistry with laboratory and theoretical components',
      },
    }),
    prisma.subject.upsert({
      where: { name: 'AP Biology' },
      update: {},
      create: {
        name: 'AP Biology',
        category: 'AP',
        description: 'Advanced Placement Biology covering molecular biology, ecology, and evolution',
      },
    }),
    prisma.subject.upsert({
      where: { name: 'AP Physics 1' },
      update: {},
      create: {
        name: 'AP Physics 1',
        category: 'AP',
        description: 'Advanced Placement Physics 1: Algebra-based mechanics and waves',
      },
    }),
    prisma.subject.upsert({
      where: { name: 'AP Physics 2' },
      update: {},
      create: {
        name: 'AP Physics 2',
        category: 'AP',
        description: 'Advanced Placement Physics 2: Algebra-based electricity and magnetism',
      },
    }),
    prisma.subject.upsert({
      where: { name: 'AP English Literature' },
      update: {},
      create: {
        name: 'AP English Literature',
        category: 'AP',
        description: 'Advanced Placement English Literature and Composition',
      },
    }),
    prisma.subject.upsert({
      where: { name: 'AP English Language' },
      update: {},
      create: {
        name: 'AP English Language',
        category: 'AP',
        description: 'Advanced Placement English Language and Composition',
      },
    }),
    prisma.subject.upsert({
      where: { name: 'AP Statistics' },
      update: {},
      create: {
        name: 'AP Statistics',
        category: 'AP',
        description: 'Advanced Placement Statistics covering data analysis and probability',
      },
    }),
    prisma.subject.upsert({
      where: { name: 'AP Computer Science A' },
      update: {},
      create: {
        name: 'AP Computer Science A',
        category: 'AP',
        description: 'Advanced Placement Computer Science A with Java programming',
      },
    }),
    
    // IB subjects
    prisma.subject.upsert({
      where: { name: 'IB Mathematics AA' },
      update: {},
      create: {
        name: 'IB Mathematics AA',
        category: 'IB',
        description: 'IB Mathematics: Analysis and Approaches (HL/SL)',
      },
    }),
    prisma.subject.upsert({
      where: { name: 'IB Mathematics AI' },
      update: {},
      create: {
        name: 'IB Mathematics AI',
        category: 'IB',
        description: 'IB Mathematics: Applications and Interpretation (HL/SL)',
      },
    }),
    prisma.subject.upsert({
      where: { name: 'IB Chemistry' },
      update: {},
      create: {
        name: 'IB Chemistry',
        category: 'IB',
        description: 'IB Chemistry (HL/SL) with laboratory component',
      },
    }),
    prisma.subject.upsert({
      where: { name: 'IB Physics' },
      update: {},
      create: {
        name: 'IB Physics',
        category: 'IB',
        description: 'IB Physics (HL/SL) covering mechanics, waves, and modern physics',
      },
    }),
    prisma.subject.upsert({
      where: { name: 'IB Biology' },
      update: {},
      create: {
        name: 'IB Biology',
        category: 'IB',
        description: 'IB Biology (HL/SL) with molecular and ecological focus',
      },
    }),
    prisma.subject.upsert({
      where: { name: 'IB English A' },
      update: {},
      create: {
        name: 'IB English A',
        category: 'IB',
        description: 'IB English A: Language and Literature (HL/SL)',
      },
    }),
  ]);

  console.log(`✅ Created ${subjects.length} subjects`);

  // Create certifications
  console.log('Creating certifications...');
  const certifications = await Promise.all([
    prisma.certification.upsert({
      where: { name: 'Certified Secondary Education Teacher' },
      update: {},
      create: {
        name: 'Certified Secondary Education Teacher',
        issuingOrganization: 'State Department of Education',
        description: 'Licensed to teach at secondary education level (grades 6-12)',
      },
    }),
    prisma.certification.upsert({
      where: { name: 'College Board AP Certified Instructor' },
      update: {},
      create: {
        name: 'College Board AP Certified Instructor',
        issuingOrganization: 'College Board',
        description: 'Certified to teach Advanced Placement courses',
      },
    }),
    prisma.certification.upsert({
      where: { name: 'IB Certified Educator' },
      update: {},
      create: {
        name: 'IB Certified Educator',
        issuingOrganization: 'International Baccalaureate',
        description: 'Certified to teach IB curriculum and programs',
      },
    }),
    prisma.certification.upsert({
      where: { name: 'SAT/ACT Test Prep Specialist' },
      update: {},
      create: {
        name: 'SAT/ACT Test Prep Specialist',
        issuingOrganization: 'Educational Testing Service',
        description: 'Specialized training in standardized test preparation strategies',
      },
    }),
    prisma.certification.upsert({
      where: { name: 'Master of Education (M.Ed.)' },
      update: {},
      create: {
        name: 'Master of Education (M.Ed.)',
        issuingOrganization: 'Accredited University',
        description: 'Advanced degree in educational theory and practice',
      },
    }),
    prisma.certification.upsert({
      where: { name: 'National Board Certified Teacher' },
      update: {},
      create: {
        name: 'National Board Certified Teacher',
        issuingOrganization: 'National Board for Professional Teaching Standards',
        description: 'Advanced certification for accomplished teachers',
      },
    }),
    prisma.certification.upsert({
      where: { name: 'Tutoring Certification' },
      update: {},
      create: {
        name: 'Tutoring Certification',
        issuingOrganization: 'Association for the Tutoring Profession',
        description: 'Professional certification in tutoring methodologies',
      },
    }),
  ]);

  console.log(`✅ Created ${certifications.length} certifications`);

  // Create sample users
  console.log('Creating sample users...');
  
  // Sample student (formerly parent)
  const studentUser2 = await prisma.user.upsert({
    where: { email: 'student2@example.com' },
    update: {},
    create: {
      email: 'student2@example.com',
      passwordHash: await bcrypt.hash('password123', 10),
      userType: 'student',
      firstName: 'Jennifer',
      lastName: 'Smith',
      phone: '+1-555-0123',
      isVerified: true,
    },
  });

  // Sample student
  const studentUser = await prisma.user.upsert({
    where: { email: 'student@example.com' },
    update: {},
    create: {
      email: 'student@example.com',
      passwordHash: await bcrypt.hash('password123', 10),
      userType: 'student',
      firstName: 'Alex',
      lastName: 'Chen',
      phone: '+1-555-0124',
      isVerified: true,
    },
  });

  // Create tutee profile for student
  const tuteeProfile = await prisma.tuteeProfile.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: {
      userId: studentUser.id,
      gradeLevel: '11th Grade',
      schoolName: 'Lincoln High School',
      learningStyle: 'visual',
      budgetMin: 40.00,
      budgetMax: 80.00,
      preferredSessionLength: 60,
      locationCity: 'San Francisco',
      locationState: 'CA',
    },
  });

  // Add learning goals for tutee
  await prisma.tuteeLearningGoal.createMany({
    data: [
      {
        tuteeId: tuteeProfile.id,
        goalText: 'Improve SAT Math score by 100+ points',
        priority: 1,
      },
      {
        tuteeId: tuteeProfile.id,
        goalText: 'Master AP Calculus concepts for college credit',
        priority: 2,
      },
      {
        tuteeId: tuteeProfile.id,
        goalText: 'Build confidence in problem-solving',
        priority: 3,
      },
    ],
    skipDuplicates: true,
  });

  // Add subject needs for tutee
  const satMathSubject = subjects.find(s => s.name === 'SAT Math');
  const apCalcSubject = subjects.find(s => s.name === 'AP Calculus AB');

  if (satMathSubject && apCalcSubject) {
    await prisma.tuteeSubjectNeed.createMany({
      data: [
        {
          tuteeId: tuteeProfile.id,
          subjectId: satMathSubject.id,
          urgencyLevel: 5,
        },
        {
          tuteeId: tuteeProfile.id,
          subjectId: apCalcSubject.id,
          urgencyLevel: 4,
        },
      ],
      skipDuplicates: true,
    });
  }

  // Sample tutors
  const tutor1 = await prisma.user.upsert({
    where: { email: 'tutor1@example.com' },
    update: {},
    create: {
      email: 'tutor1@example.com',
      passwordHash: await bcrypt.hash('password123', 10),
      userType: 'tutor',
      firstName: 'Sarah',
      lastName: 'Johnson',
      phone: '+1-555-0125',
      isVerified: true,
    },
  });

  const tutor2 = await prisma.user.upsert({
    where: { email: 'tutor2@example.com' },
    update: {},
    create: {
      email: 'tutor2@example.com',
      passwordHash: await bcrypt.hash('password123', 10),
      userType: 'tutor',
      firstName: 'Michael',
      lastName: 'Rodriguez',
      phone: '+1-555-0126',
      isVerified: true,
    },
  });

  // Create tutor profiles
  const tutorProfile1 = await prisma.tutorProfile.upsert({
    where: { userId: tutor1.id },
    update: {},
    create: {
      userId: tutor1.id,
      hourlyRate: 65.00,
      educationLevel: 'Masters',
      university: 'Stanford University',
      major: 'Mathematics Education',
      graduationYear: 2018,
      teachingExperienceYears: 5,
      bio: 'Experienced math tutor specializing in SAT prep and AP Calculus. I have helped over 100 students improve their test scores and build confidence in mathematics.',
      teachingMethodology: 'Interactive problem-solving with personalized learning plans tailored to each student\'s needs',
      availabilityTimezone: 'America/Los_Angeles',
      isVerified: true,
      isBackgroundChecked: true,
      ratingAverage: 4.8,
      totalReviews: 127,
      totalSessions: 156,
    },
  });

  const tutorProfile2 = await prisma.tutorProfile.upsert({
    where: { userId: tutor2.id },
    update: {},
    create: {
      userId: tutor2.id,
      hourlyRate: 55.00,
      educationLevel: 'Bachelors',
      university: 'UC Berkeley',
      major: 'Chemical Engineering',
      graduationYear: 2020,
      teachingExperienceYears: 3,
      bio: 'Recent graduate with strong background in STEM subjects. Passionate about helping students excel in chemistry and physics.',
      teachingMethodology: 'Hands-on approach with real-world examples and practice problems',
      availabilityTimezone: 'America/Los_Angeles',
      isVerified: true,
      ratingAverage: 4.6,
      totalReviews: 45,
      totalSessions: 67,
    },
  });

  // Add subjects for tutors
  if (satMathSubject && apCalcSubject) {
    await prisma.tutorSubject.createMany({
      data: [
        {
          tutorId: tutorProfile1.id,
          subjectId: satMathSubject.id,
          proficiencyLevel: 5,
          yearsExperience: 5,
        },
        {
          tutorId: tutorProfile1.id,
          subjectId: apCalcSubject.id,
          proficiencyLevel: 5,
          yearsExperience: 4,
        },
      ],
      skipDuplicates: true,
    });
  }

  const apChemSubject = subjects.find(s => s.name === 'AP Chemistry');
  const apPhysicsSubject = subjects.find(s => s.name === 'AP Physics 1');

  if (apChemSubject && apPhysicsSubject) {
    await prisma.tutorSubject.createMany({
      data: [
        {
          tutorId: tutorProfile2.id,
          subjectId: apChemSubject.id,
          proficiencyLevel: 5,
          yearsExperience: 3,
        },
        {
          tutorId: tutorProfile2.id,
          subjectId: apPhysicsSubject.id,
          proficiencyLevel: 4,
          yearsExperience: 2,
        },
      ],
      skipDuplicates: true,
    });
  }

  // Add certifications for tutors
  const teachingCert = certifications.find(c => c.name === 'Certified Secondary Education Teacher');
  const testPrepCert = certifications.find(c => c.name === 'SAT/ACT Test Prep Specialist');

  if (teachingCert && testPrepCert) {
    await prisma.tutorCertification.createMany({
      data: [
        {
          tutorId: tutorProfile1.id,
          certificationId: teachingCert.id,
          earnedDate: new Date('2018-06-15'),
          isVerified: true,
        },
        {
          tutorId: tutorProfile1.id,
          certificationId: testPrepCert.id,
          earnedDate: new Date('2019-03-10'),
          isVerified: true,
        },
      ],
      skipDuplicates: true,
    });
  }

  // Add languages for tutors
  await prisma.tutorLanguage.createMany({
    data: [
      {
        tutorId: tutorProfile1.id,
        languageName: 'English',
        proficiencyLevel: 'native',
      },
      {
        tutorId: tutorProfile1.id,
        languageName: 'Spanish',
        proficiencyLevel: 'conversational',
      },
      {
        tutorId: tutorProfile2.id,
        languageName: 'English',
        proficiencyLevel: 'native',
      },
      {
        tutorId: tutorProfile2.id,
        languageName: 'Mandarin',
        proficiencyLevel: 'fluent',
      },
    ],
    skipDuplicates: true,
  });

  // Add availability for tutors
  await prisma.tutorAvailability.createMany({
    data: [
      // Tutor 1 availability (Monday to Friday, 3 PM to 8 PM)
      ...Array.from({ length: 5 }, (_, i) => ({
        tutorId: tutorProfile1.id,
        dayOfWeek: i + 1, // Monday = 1, Friday = 5
        startTime: '15:00',
        endTime: '20:00',
        isAvailable: true,
      })),
      // Saturday morning
      {
        tutorId: tutorProfile1.id,
        dayOfWeek: 6,
        startTime: '09:00',
        endTime: '12:00',
        isAvailable: true,
      },
      // Tutor 2 availability (Tuesday to Saturday, 4 PM to 9 PM)
      ...Array.from({ length: 5 }, (_, i) => ({
        tutorId: tutorProfile2.id,
        dayOfWeek: i + 2, // Tuesday = 2, Saturday = 6
        startTime: '16:00',
        endTime: '21:00',
        isAvailable: true,
      })),
    ],
    skipDuplicates: true,
  });

  console.log('✅ Created sample users and profiles');
  console.log(`   - Student 1: ${studentUser.email}`);
  console.log(`   - Student 2: ${studentUser2.email}`);
  console.log(`   - Tutor 1: ${tutor1.email}`);
  console.log(`   - Tutor 2: ${tutor2.email}`);

  console.log('🎉 Database seeded successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - ${sessionStatuses.length} session statuses`);
  console.log(`   - ${paymentStatuses.length} payment statuses`);
  console.log(`   - ${subjects.length} subjects (SAT, ACT, AP, IB)`);
  console.log(`   - ${certifications.length} certifications`);
  console.log(`   - 4 sample users (2 students, 2 tutors)`);
  console.log(`   - Complete profiles with subjects, certifications, and availability`);
  
  console.log('\n🔑 Login credentials for testing:');
  console.log('   Student 1: student@example.com / password123');
  console.log('   Student 2: student2@example.com / password123');
  console.log('   Tutor 1: tutor1@example.com / password123');
  console.log('   Tutor 2: tutor2@example.com / password123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error seeding database:', e);
    await prisma.$disconnect();
    process.exit(1);
  }); 