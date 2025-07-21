# 🎓 TutorConnect

**A comprehensive academic tutoring marketplace platform for AP, IB, SAT, and ACT exam preparation.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)

---

## 🚀 Quick Start

Get TutorConnect running in under 5 minutes:

```bash
# 1. Clone the repository
git clone <your-repo-url> tutorconnect
cd tutorconnect

# 2. Run automated setup
./setup.sh

# 3. Start development
npm run dev
```

🎉 **That's it!** Visit [http://localhost:3001/health](http://localhost:3001/health) to see your API running.

For detailed setup instructions, see [QUICK_START.md](QUICK_START.md).

---

## 📋 What is TutorConnect?

TutorConnect is a modern, full-stack marketplace that connects qualified tutors with students and parents seeking academic support. Built with enterprise-grade architecture and modern technologies.

### 🎯 Target Audience
- **Students**: High school students preparing for AP, IB, SAT, ACT exams
- **Parents**: Seeking qualified tutors for their children's academic success
- **Tutors**: Certified educators and subject matter experts

### ✨ Key Features

#### For Students & Parents
- 🔍 **Smart Tutor Matching** - Find tutors based on subject, budget, schedule, and learning style
- 📅 **Flexible Scheduling** - Book sessions that fit your calendar
- 💬 **Real-time Messaging** - Communicate directly with tutors
- 💳 **Secure Payments** - Integrated Stripe payment processing
- ⭐ **Reviews & Ratings** - Make informed decisions based on peer feedback

#### For Tutors
- 📝 **Professional Profiles** - Showcase education, certifications, and experience
- ⏰ **Availability Management** - Set your schedule with override support
- 💰 **Transparent Earnings** - Clear fee structure and payment tracking
- 📊 **Performance Analytics** - Track your success and student outcomes
- 🎥 **Virtual Sessions** - Integrated Zoom for online tutoring

#### For Platform
- 🛡️ **Security First** - JWT authentication with token rotation and session management
- 📈 **Real-time Analytics** - Comprehensive monitoring and observability
- 🔄 **Event-Driven Architecture** - Scalable background job processing
- 🌐 **API-First Design** - RESTful APIs with comprehensive documentation

---

### 🛠️ Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 13, React 18, TypeScript | Modern web interface with SSR |
| **Backend** | Node.js, Express, TypeScript | RESTful API with real-time features |
| **Database** | PostgreSQL 15, Prisma ORM | Relational data with type safety |
| **Cache** | Redis 7 | Session management and caching |
| **Real-time** | Socket.IO | Live messaging and notifications |
| **Payments** | Stripe | Secure payment processing |
| **Monitoring** | OpenTelemetry, Winston | Observability and logging |
| **Infrastructure** | Docker, Docker Compose | Containerized development |
| **CI/CD** | GitHub Actions, Husky | Automated testing and deployment |

---

## 📊 Database Schema

Comprehensive data model supporting complex tutoring marketplace requirements:

![Database Schema](docs/images/database-schema.png)

### Key Entities
- **Users**: Students, parents, tutors with role-based permissions
- **Profiles**: Detailed tutee and tutor information
- **Sessions**: Booking, scheduling, and session management
- **Messaging**: Real-time communication system
- **Payments**: Transaction tracking with Stripe integration
- **Reviews**: Rating and feedback system
- **Audit Logs**: Complete activity tracking for compliance

For detailed schema documentation, see [DATABASE_SETUP_GUIDE.md](DATABASE_SETUP_GUIDE.md).

---

## 🔐 Security & Compliance

TutorConnect implements enterprise-grade security:

### Authentication & Authorization
- 🔑 **JWT Tokens** with refresh token rotation
- 🍪 **HTTP-only Cookies** for secure token storage
- 🔒 **Session Management** with Redis tracking
- 👥 **Role-based Access Control** (student, parent, tutor, admin)

### Data Protection
- 🛡️ **Input Validation** with Zod schemas
- 🔒 **SQL Injection Protection** via Prisma ORM
- 🌐 **CORS & CSP** headers configured
- 🚦 **Rate Limiting** to prevent abuse
- 📝 **Audit Logging** for compliance (COPPA, GDPR ready)

### Monitoring & Observability
- 📊 **OpenTelemetry** distributed tracing
- 📈 **Structured Logging** with Winston
- 🚨 **Error Tracking** and alerting
- 📊 **Performance Monitoring** and metrics

For detailed deployment instructions, see [infra/README.md](infra/README.md).