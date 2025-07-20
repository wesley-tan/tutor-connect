# Database Setup Guide - TutorConnect
## Complete PostgreSQL Database Setup with Prisma

### 🐳 **Option 1: Quick Setup with Docker (Recommended for Development)**

#### Step 1: Create Docker Compose Configuration

Create `docker-compose.yml` in your project root:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: tutorconnect-db
    environment:
      POSTGRES_DB: tutorconnect_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --lc-collate=en_US.UTF-8 --lc-ctype=en_US.UTF-8"
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d tutorconnect_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: tutorconnect-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  # Optional: Database admin interface
  pgadmin:
    image: dpage/pgadmin4
    container_name: tutorconnect-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@tutorconnect.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres

volumes:
  postgres_data:
  redis_data:
```

#### Step 2: Start the Database

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Check if containers are running
docker-compose ps

# View logs if needed
docker-compose logs postgres
```

### 📋 **Step 3: Set Up Prisma Schema**

Create `packages/database/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// User types enum
enum UserType {
  student
  parent
  tutor
  @@map("user_type_enum")
}

enum LearningStyle {
  visual
  auditory
  kinesthetic
  mixed
  @@map("learning_style_enum")
}

enum SessionType {
  online
  in_person
  @@map("session_type_enum")
}

enum SessionStatus {
  scheduled
  in_progress
  completed
  cancelled
  no_show
  @@map("session_status_enum")
}

enum MessageType {
  text
  file
  image
  system
  @@map("message_type_enum")
}

enum PaymentStatus {
  pending
  succeeded
  failed
  cancelled
  refunded
  @@map("payment_status_enum")
}

// Base user model
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  passwordHash    String    @map("password_hash")
  userType        UserType  @map("user_type")
  firstName       String    @map("first_name")
  lastName        String    @map("last_name")
  phone           String?
  profileImageUrl String?   @map("profile_image_url")
  timezone        String    @default("UTC")
  isVerified      Boolean   @default(false) @map("is_verified")
  isActive        Boolean   @default(true) @map("is_active")
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz()

  // Relations
  tuteeProfile     TuteeProfile?
  tutorProfile     TutorProfile?
  sentMessages     Message[]          @relation("MessageSender")
  receivedMessages Message[]          @relation("MessageReceiver")
  conversationsA   Conversation[]     @relation("ConversationParticipantA")
  conversationsB   Conversation[]     @relation("ConversationParticipantB")
  reviewsGiven     Review[]           @relation("ReviewGiver")
  reviewsReceived  Review[]           @relation("ReviewReceiver")
  payments         Payment[]          @relation("PaymentPayer")
  paymentsReceived Payment[]          @relation("PaymentRecipient")

  @@index([email])
  @@index([userType])
  @@index([isActive])
  @@map("users")
}

// Reference tables
model Subject {
  id          String   @id @default(cuid())
  name        String   @unique
  category    String   // 'AP', 'IB', 'SAT', 'ACT', 'General'
  description String?
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz()

  // Relations
  tutorSubjects    TutorSubject[]
  tuteeSubjectNeeds TuteeSubjectNeed[]
  sessions         Session[]

  @@index([category])
  @@index([isActive])
  @@map("subjects")
}

model Certification {
  id                   String   @id @default(cuid())
  name                 String   @unique
  issuingOrganization  String?  @map("issuing_organization")
  description          String?
  isActive             Boolean  @default(true) @map("is_active")
  createdAt            DateTime @default(now()) @map("created_at") @db.Timestamptz()

  // Relations
  tutorCertifications TutorCertification[]

  @@index([isActive])
  @@map("certifications")
}

// Tutee profile and related tables
model TuteeProfile {
  id                      String         @id @default(cuid())
  userId                  String         @unique @map("user_id")
  gradeLevel              String?        @map("grade_level")
  schoolName              String?        @map("school_name")
  learningStyle           LearningStyle? @map("learning_style")
  budgetMin               Decimal?       @map("budget_min") @db.Decimal(10, 2)
  budgetMax               Decimal?       @map("budget_max") @db.Decimal(10, 2)
  preferredSessionLength  Int            @default(60) @map("preferred_session_length")
  locationCity            String?        @map("location_city")
  locationState           String?        @map("location_state")
  parentId                String?        @map("parent_id")
  createdAt               DateTime       @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt               DateTime       @updatedAt @map("updated_at") @db.Timestamptz()

  // Relations
  user             User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  parent           User?                  @relation("ParentChild", fields: [parentId], references: [id])
  learningGoals    TuteeLearningGoal[]
  subjectNeeds     TuteeSubjectNeed[]
  sessions         Session[]

  @@map("tutee_profiles")
}

model TuteeLearningGoal {
  id        String   @id @default(cuid())
  tuteeId   String   @map("tutee_id")
  goalText  String   @map("goal_text")
  priority  Int      @default(1)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz()

  // Relations
  tutee TuteeProfile @relation(fields: [tuteeId], references: [id], onDelete: Cascade)

  @@map("tutee_learning_goals")
}

model TuteeSubjectNeed {
  id           String   @id @default(cuid())
  tuteeId      String   @map("tutee_id")
  subjectId    String   @map("subject_id")
  urgencyLevel Int      @default(1) @map("urgency_level")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz()

  // Relations
  tutee   TuteeProfile @relation(fields: [tuteeId], references: [id], onDelete: Cascade)
  subject Subject      @relation(fields: [subjectId], references: [id], onDelete: Cascade)

  @@unique([tuteeId, subjectId])
  @@map("tutee_subject_needs")
}

// Tutor profile and related tables
model TutorProfile {
  id                       String    @id @default(cuid())
  userId                   String    @unique @map("user_id")
  hourlyRate               Decimal   @map("hourly_rate") @db.Decimal(10, 2)
  educationLevel           String?   @map("education_level")
  university               String?
  major                    String?
  graduationYear           Int?      @map("graduation_year")
  teachingExperienceYears  Int       @default(0) @map("teaching_experience_years")
  bio                      String?
  teachingMethodology      String?   @map("teaching_methodology")
  availabilityTimezone     String?   @map("availability_timezone")
  isBackgroundChecked      Boolean   @default(false) @map("is_background_checked")
  backgroundCheckDate      DateTime? @map("background_check_date") @db.Timestamptz()
  ratingAverage            Decimal   @default(0.0) @map("rating_average") @db.Decimal(3, 2)
  totalReviews             Int       @default(0) @map("total_reviews")
  totalSessions            Int       @default(0) @map("total_sessions")
  isVerified               Boolean   @default(false) @map("is_verified")
  createdAt                DateTime  @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt                DateTime  @updatedAt @map("updated_at") @db.Timestamptz()

  // Relations
  user              User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  subjects          TutorSubject[]
  certifications    TutorCertification[]
  specializations   TutorSpecialization[]
  languages         TutorLanguage[]
  availability      TutorAvailability[]
  sessions          Session[]

  @@index([ratingAverage])
  @@index([hourlyRate])
  @@index([isVerified])
  @@map("tutor_profiles")
}

model TutorSubject {
  id               String   @id @default(cuid())
  tutorId          String   @map("tutor_id")
  subjectId        String   @map("subject_id")
  proficiencyLevel Int      @default(1) @map("proficiency_level")
  yearsExperience  Int      @default(0) @map("years_experience")
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz()

  // Relations
  tutor   TutorProfile @relation(fields: [tutorId], references: [id], onDelete: Cascade)
  subject Subject      @relation(fields: [subjectId], references: [id], onDelete: Cascade)

  @@unique([tutorId, subjectId])
  @@index([proficiencyLevel])
  @@map("tutor_subjects")
}

model TutorCertification {
  id              String    @id @default(cuid())
  tutorId         String    @map("tutor_id")
  certificationId String    @map("certification_id")
  earnedDate      DateTime? @map("earned_date") @db.Date
  expiryDate      DateTime? @map("expiry_date") @db.Date
  credentialUrl   String?   @map("credential_url")
  isVerified      Boolean   @default(false) @map("is_verified")
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz()

  // Relations
  tutor         TutorProfile  @relation(fields: [tutorId], references: [id], onDelete: Cascade)
  certification Certification @relation(fields: [certificationId], references: [id], onDelete: Cascade)

  @@unique([tutorId, certificationId])
  @@map("tutor_certifications")
}

model TutorSpecialization {
  id                   String   @id @default(cuid())
  tutorId              String   @map("tutor_id")
  specializationName   String   @map("specialization_name")
  description          String?
  createdAt            DateTime @default(now()) @map("created_at") @db.Timestamptz()

  // Relations
  tutor TutorProfile @relation(fields: [tutorId], references: [id], onDelete: Cascade)

  @@map("tutor_specializations")
}

model TutorLanguage {
  id               String   @id @default(cuid())
  tutorId          String   @map("tutor_id")
  languageName     String   @map("language_name")
  proficiencyLevel String   @default("conversational") @map("proficiency_level")
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz()

  // Relations
  tutor TutorProfile @relation(fields: [tutorId], references: [id], onDelete: Cascade)

  @@unique([tutorId, languageName])
  @@map("tutor_languages")
}

model TutorAvailability {
  id          String   @id @default(cuid())
  tutorId     String   @map("tutor_id")
  dayOfWeek   Int      @map("day_of_week")
  startTime   String   @map("start_time") // Store as "HH:MM" format
  endTime     String   @map("end_time")   // Store as "HH:MM" format
  isAvailable Boolean  @default(true) @map("is_available")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz()

  // Relations
  tutor TutorProfile @relation(fields: [tutorId], references: [id], onDelete: Cascade)

  @@unique([tutorId, dayOfWeek, startTime, endTime])
  @@index([tutorId, dayOfWeek])
  @@index([isAvailable])
  @@map("tutor_availability")
}

// Messaging system
model Conversation {
  id            String    @id @default(cuid())
  participantA  String    @map("participant_a")
  participantB  String    @map("participant_b")
  lastMessageAt DateTime? @map("last_message_at") @db.Timestamptz()
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt     DateTime  @updatedAt @map("updated_at") @db.Timestamptz()

  // Relations
  userA    User      @relation("ConversationParticipantA", fields: [participantA], references: [id], onDelete: Cascade)
  userB    User      @relation("ConversationParticipantB", fields: [participantB], references: [id], onDelete: Cascade)
  messages Message[]

  @@unique([participantA, participantB])
  @@index([participantA, participantB])
  @@map("conversations")
}

model Message {
  id             String      @id @default(cuid())
  conversationId String      @map("conversation_id")
  senderId       String      @map("sender_id")
  receiverId     String      @map("receiver_id")
  messageText    String      @map("message_text")
  messageType    MessageType @default(text) @map("message_type")
  fileUrl        String?     @map("file_url")
  fileName       String?     @map("file_name")
  fileSizeBytes  Int?        @map("file_size_bytes")
  isRead         Boolean     @default(false) @map("is_read")
  readAt         DateTime?   @map("read_at") @db.Timestamptz()
  createdAt      DateTime    @default(now()) @map("created_at") @db.Timestamptz()

  // Relations
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender       User         @relation("MessageSender", fields: [senderId], references: [id])
  receiver     User         @relation("MessageReceiver", fields: [receiverId], references: [id])

  @@index([conversationId, createdAt])
  @@index([receiverId, isRead])
  @@map("messages")
}

// Sessions and bookings
model Session {
  id             String        @id @default(cuid())
  tuteeId        String        @map("tutee_id")
  tutorId        String        @map("tutor_id")
  subjectId      String        @map("subject_id")
  scheduledStart DateTime      @map("scheduled_start") @db.Timestamptz()
  scheduledEnd   DateTime      @map("scheduled_end") @db.Timestamptz()
  actualStart    DateTime?     @map("actual_start") @db.Timestamptz()
  actualEnd      DateTime?     @map("actual_end") @db.Timestamptz()
  sessionType    SessionType   @default(online) @map("session_type")
  zoomMeetingId  String?       @map("zoom_meeting_id")
  zoomJoinUrl    String?       @map("zoom_join_url")
  zoomPassword   String?       @map("zoom_password")
  sessionNotes   String?       @map("session_notes")
  homeworkAssigned String?     @map("homework_assigned")
  status         SessionStatus @default(scheduled)
  cancellationReason String?   @map("cancellation_reason")
  pricePaid      Decimal?      @map("price_paid") @db.Decimal(10, 2)
  platformFee    Decimal?      @map("platform_fee") @db.Decimal(10, 2)
  tutorEarnings  Decimal?      @map("tutor_earnings") @db.Decimal(10, 2)
  createdAt      DateTime      @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt      DateTime      @updatedAt @map("updated_at") @db.Timestamptz()

  // Relations
  tutee   TuteeProfile @relation(fields: [tuteeId], references: [id])
  tutor   TutorProfile @relation(fields: [tutorId], references: [id])
  subject Subject      @relation(fields: [subjectId], references: [id])
  payment Payment?
  review  Review?

  @@index([tuteeId])
  @@index([tutorId])
  @@index([status])
  @@index([scheduledStart])
  @@map("sessions")
}

// Reviews and ratings
model Review {
  id                    String   @id @default(cuid())
  sessionId             String   @unique @map("session_id")
  reviewerId            String   @map("reviewer_id")
  revieweeId            String   @map("reviewee_id")
  rating                Int
  reviewText            String?  @map("review_text")
  teachingEffectiveness Int?     @map("teaching_effectiveness")
  communication         Int?
  punctuality           Int?
  wouldRecommend        Boolean? @map("would_recommend")
  isAnonymous           Boolean  @default(false) @map("is_anonymous")
  createdAt             DateTime @default(now()) @map("created_at") @db.Timestamptz()

  // Relations
  session  Session @relation(fields: [sessionId], references: [id])
  reviewer User    @relation("ReviewGiver", fields: [reviewerId], references: [id])
  reviewee User    @relation("ReviewReceiver", fields: [revieweeId], references: [id])

  @@index([revieweeId])
  @@index([sessionId])
  @@map("reviews")
}

// Payments
model Payment {
  id                     String        @id @default(cuid())
  sessionId              String        @unique @map("session_id")
  payerId                String        @map("payer_id")
  recipientId            String        @map("recipient_id")
  stripePaymentIntentId  String?       @unique @map("stripe_payment_intent_id")
  stripeCustomerId       String?       @map("stripe_customer_id")
  amount                 Decimal       @db.Decimal(10, 2)
  platformFee            Decimal       @map("platform_fee") @db.Decimal(10, 2)
  netAmount              Decimal       @map("net_amount") @db.Decimal(10, 2)
  currency               String        @default("USD")
  status                 PaymentStatus @default(pending)
  paymentMethod          String?       @map("payment_method")
  failureReason          String?       @map("failure_reason")
  refundAmount           Decimal       @default(0) @map("refund_amount") @db.Decimal(10, 2)
  createdAt              DateTime      @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt              DateTime      @updatedAt @map("updated_at") @db.Timestamptz()

  // Relations
  session   Session @relation(fields: [sessionId], references: [id])
  payer     User    @relation("PaymentPayer", fields: [payerId], references: [id])
  recipient User    @relation("PaymentRecipient", fields: [recipientId], references: [id])

  @@index([payerId])
  @@index([recipientId])
  @@index([status])
  @@index([sessionId])
  @@map("payments")
}
```

#### Step 4: Configure Environment Variables

Create `.env` in your project root:

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/tutorconnect_dev"
REDIS_URL="redis://localhost:6379"

# Authentication
JWT_SECRET="your-super-secret-jwt-key-at-least-32-characters-long"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-at-least-32-characters-long"

# Stripe
STRIPE_SECRET_KEY="sk_test_your_stripe_secret_key"
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret"

# Other services
NODE_ENV="development"
FRONTEND_URL="http://localhost:3000"
```

#### Step 5: Initialize Prisma and Create Database

```bash
# Install Prisma CLI if not already installed
npm install -g prisma

# Navigate to your database package
cd packages/database

# Install dependencies
npm install prisma @prisma/client

# Generate Prisma client
npx prisma generate

# Create and run initial migration
npx prisma migrate dev --name init

# Open Prisma Studio to view your database (optional)
npx prisma studio
```

### 🌱 **Step 6: Seed the Database with Initial Data**

Create `packages/database/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create subjects
  const subjects = await Promise.all([
    // SAT subjects
    prisma.subject.create({
      data: {
        name: 'SAT Math',
        category: 'SAT',
        description: 'SAT Mathematics section preparation',
      },
    }),
    prisma.subject.create({
      data: {
        name: 'SAT Reading & Writing',
        category: 'SAT',
        description: 'SAT Evidence-Based Reading and Writing',
      },
    }),
    
    // ACT subjects
    prisma.subject.create({
      data: {
        name: 'ACT Math',
        category: 'ACT',
        description: 'ACT Mathematics section',
      },
    }),
    prisma.subject.create({
      data: {
        name: 'ACT English',
        category: 'ACT',
        description: 'ACT English section',
      },
    }),
    prisma.subject.create({
      data: {
        name: 'ACT Science',
        category: 'ACT',
        description: 'ACT Science section',
      },
    }),
    
    // AP subjects
    prisma.subject.create({
      data: {
        name: 'AP Calculus AB',
        category: 'AP',
        description: 'Advanced Placement Calculus AB',
      },
    }),
    prisma.subject.create({
      data: {
        name: 'AP Chemistry',
        category: 'AP',
        description: 'Advanced Placement Chemistry',
      },
    }),
    prisma.subject.create({
      data: {
        name: 'AP Biology',
        category: 'AP',
        description: 'Advanced Placement Biology',
      },
    }),
    prisma.subject.create({
      data: {
        name: 'AP Physics 1',
        category: 'AP',
        description: 'Advanced Placement Physics 1',
      },
    }),
    prisma.subject.create({
      data: {
        name: 'AP English Literature',
        category: 'AP',
        description: 'Advanced Placement English Literature and Composition',
      },
    }),
    
    // IB subjects
    prisma.subject.create({
      data: {
        name: 'IB Mathematics AA',
        category: 'IB',
        description: 'IB Mathematics: Analysis and Approaches',
      },
    }),
    prisma.subject.create({
      data: {
        name: 'IB Chemistry',
        category: 'IB',
        description: 'IB Chemistry (HL/SL)',
      },
    }),
    prisma.subject.create({
      data: {
        name: 'IB Physics',
        category: 'IB',
        description: 'IB Physics (HL/SL)',
      },
    }),
    prisma.subject.create({
      data: {
        name: 'IB English A',
        category: 'IB',
        description: 'IB English A: Language and Literature',
      },
    }),
  ]);

  console.log(`✅ Created ${subjects.length} subjects`);

  // Create certifications
  const certifications = await Promise.all([
    prisma.certification.create({
      data: {
        name: 'Certified Secondary Education Teacher',
        issuingOrganization: 'State Department of Education',
        description: 'Licensed to teach at secondary education level',
      },
    }),
    prisma.certification.create({
      data: {
        name: 'College Board AP Certified',
        issuingOrganization: 'College Board',
        description: 'Certified to teach Advanced Placement courses',
      },
    }),
    prisma.certification.create({
      data: {
        name: 'IB Certified Educator',
        issuingOrganization: 'International Baccalaureate',
        description: 'Certified to teach IB curriculum',
      },
    }),
    prisma.certification.create({
      data: {
        name: 'SAT/ACT Prep Specialist',
        issuingOrganization: 'Educational Testing Service',
        description: 'Specialized in standardized test preparation',
      },
    }),
    prisma.certification.create({
      data: {
        name: 'Masters in Education',
        issuingOrganization: 'Accredited University',
        description: 'Advanced degree in Education',
      },
    }),
  ]);

  console.log(`✅ Created ${certifications.length} certifications`);

  // Create sample users (you can modify or remove this in production)
  const sampleTutor = await prisma.user.create({
    data: {
      email: 'tutor@example.com',
      passwordHash: '$2b$10$example.hash.here', // Use bcrypt in real implementation
      userType: 'tutor',
      firstName: 'Sarah',
      lastName: 'Johnson',
      isVerified: true,
      tutorProfile: {
        create: {
          hourlyRate: 65.00,
          educationLevel: 'Masters',
          university: 'Harvard University',
          major: 'Mathematics Education',
          graduationYear: 2018,
          teachingExperienceYears: 5,
          bio: 'Experienced math tutor specializing in AP Calculus and SAT Math prep.',
          teachingMethodology: 'Interactive problem-solving with personalized learning plans',
          availabilityTimezone: 'America/New_York',
          isVerified: true,
          ratingAverage: 4.8,
          totalReviews: 127,
          totalSessions: 156,
        },
      },
    },
  });

  // Add subjects to the sample tutor
  await prisma.tutorSubject.createMany({
    data: [
      {
        tutorId: sampleTutor.tutorProfile!.id,
        subjectId: subjects.find(s => s.name === 'SAT Math')!.id,
        proficiencyLevel: 5,
        yearsExperience: 5,
      },
      {
        tutorId: sampleTutor.tutorProfile!.id,
        subjectId: subjects.find(s => s.name === 'AP Calculus AB')!.id,
        proficiencyLevel: 5,
        yearsExperience: 4,
      },
    ],
  });

  console.log('✅ Created sample tutor with subjects');

  const sampleStudent = await prisma.user.create({
    data: {
      email: 'student@example.com',
      passwordHash: '$2b$10$example.hash.here',
      userType: 'student',
      firstName: 'Alex',
      lastName: 'Chen',
      isVerified: true,
      tuteeProfile: {
        create: {
          gradeLevel: '11th Grade',
          schoolName: 'Lincoln High School',
          learningStyle: 'visual',
          budgetMin: 40.00,
          budgetMax: 80.00,
          preferredSessionLength: 60,
          locationCity: 'San Francisco',
          locationState: 'CA',
        },
      },
    },
  });

  // Add subject needs for the sample student
  await prisma.tuteeSubjectNeed.create({
    data: {
      tuteeId: sampleStudent.tuteeProfile!.id,
      subjectId: subjects.find(s => s.name === 'SAT Math')!.id,
      urgencyLevel: 5,
    },
  });

  console.log('✅ Created sample student with subject needs');

  console.log('🎉 Database seeded successfully!');
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
```

Run the seed script:

```bash
# Add to package.json scripts
npm pkg set scripts.db:seed="prisma db seed"

# Run the seed
npm run db:seed
```

### 🧪 **Step 7: Test Your Database Setup**

Create a test script `test-db.js`:

```javascript
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabase() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Test data retrieval
    const subjectCount = await prisma.subject.count();
    console.log(`✅ Found ${subjectCount} subjects in database`);
    
    const tutorCount = await prisma.user.count({
      where: { userType: 'tutor' }
    });
    console.log(`✅ Found ${tutorCount} tutors in database`);
    
    // Test complex query
    const tutorsWithSubjects = await prisma.tutorProfile.findMany({
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        subjects: {
          include: {
            subject: {
              select: {
                name: true,
                category: true,
              }
            }
          }
        }
      }
    });
    
    console.log('✅ Complex query test passed');
    console.log(`Found tutors:`, tutorsWithSubjects.map(t => ({
      name: `${t.user.firstName} ${t.user.lastName}`,
      subjects: t.subjects.map(s => s.subject.name)
    })));
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();
```

Run the test:

```bash
node test-db.js
```

---

## 🏗️ **Option 2: Manual PostgreSQL Setup**

If you prefer not to use Docker:

### 1. Install PostgreSQL Locally

**macOS (using Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql-15 postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows:**
Download from [postgresql.org](https://www.postgresql.org/download/windows/)

### 2. Create Database and User

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE tutorconnect_dev;
CREATE USER tutorconnect_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE tutorconnect_dev TO tutorconnect_user;

# Create types (these will be created by Prisma, but good to know)
\c tutorconnect_dev;
-- Your custom types will be created automatically by Prisma

\q
```

### 3. Update Environment Variables

```bash
DATABASE_URL="postgresql://tutorconnect_user:your_secure_password@localhost:5432/tutorconnect_dev"
```

---

## 🚀 **Quick Start Commands Summary**

```bash
# 1. Start database with Docker
docker-compose up -d postgres redis

# 2. Install dependencies
npm install prisma @prisma/client

# 3. Generate Prisma client
npx prisma generate

# 4. Run migrations
npx prisma migrate dev --name init

# 5. Seed database
npm run db:seed

# 6. View database (optional)
npx prisma studio

# 7. Test connection
node test-db.js
```

## 🔧 **Useful Database Commands**

```bash
# Reset database completely
npx prisma migrate reset

# View current migration status
npx prisma migrate status

# Generate new migration after schema changes
npx prisma migrate dev --name your_migration_name

# Deploy migrations to production
npx prisma migrate deploy

# View database in browser
npx prisma studio

# Format Prisma schema
npx prisma format
```

## 📊 **Access Database Tools**

1. **Prisma Studio**: `npx prisma studio` (http://localhost:5555)
2. **pgAdmin** (if using Docker): http://localhost:5050
   - Email: admin@tutorconnect.com
   - Password: admin
3. **Command line**: `docker exec -it tutorconnect-db psql -U postgres -d tutorconnect_dev`

Your database is now ready for development! 🎉 