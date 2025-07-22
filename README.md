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

### Key Entities
- **Users**: Students, parents, tutors with role-based permissions
- **Profiles**: Detailed tutee and tutor information
- **Sessions**: Booking, scheduling, and session management
- **Messaging**: Real-time communication system
- **Payments**: Transaction tracking with Stripe integration
- **Reviews**: Rating and feedback system
- **Audit Logs**: Complete activity tracking for compliance
