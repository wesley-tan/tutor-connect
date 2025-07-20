# TutorConnect - Project Initialization Plan
## Step-by-Step Implementation with Testable Results

> **Goal**: After each phase, you can run the code and see working functionality!

---

## 🏗️ **Phase 1: Foundation Setup (Day 1-2)**
**Result**: Database running + Basic API responding

### **Step 1.1: Project Structure & Environment**
```bash
# Create project structure
mkdir tutor-matching
cd tutor-matching

# Initialize monorepo
npm init -y
npm install turbo --save-dev

# Create workspace structure
mkdir -p apps/api apps/web packages/database packages/shared-types
mkdir -p infra/docker docs
```

**Create `package.json` (root):**
```json
{
  "name": "tutorconnect",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "db:setup": "cd packages/database && npm run setup",
    "db:reset": "cd packages/database && npm run reset"
  },
  "devDependencies": {
    "turbo": "latest"
  }
}
```

### **Step 1.2: Database Setup**
```bash
# Set up database package
cd packages/database
npm init -y
npm install prisma @prisma/client
npm install -D typescript @types/node
```

**Create `packages/database/package.json`:**
```json
{
  "name": "@tutorconnect/database",
  "scripts": {
    "setup": "prisma generate && prisma migrate dev --name init && prisma db seed",
    "reset": "prisma migrate reset --force && npm run setup",
    "studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "latest",
    "prisma": "latest"
  }
}
```

**Copy the Prisma schema from DATABASE_SETUP_GUIDE.md**

### **Step 1.3: Docker Setup**
**Create `docker-compose.yml` (root):**
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
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
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

volumes:
  postgres_data:
  redis_data:
```

**Create `.env` (root):**
```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/tutorconnect_dev"
JWT_SECRET="your-super-secret-jwt-key-at-least-32-characters-long"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-at-least-32-characters-long"
NODE_ENV="development"
```

### **Step 1.4: Test Phase 1**
```bash
# Start database
docker-compose up -d postgres

# Set up database
npm run db:setup

# Test connection
cd packages/database
npx prisma studio
```

**✅ Success Criteria**: 
- Prisma Studio opens at http://localhost:5555
- You can see all tables with sample data
- No error messages

---

## 🚀 **Phase 2: Basic API (Day 2-3)**
**Result**: REST API with authentication working

### **Step 2.1: API Setup**
```bash
cd apps/api
npm init -y
npm install express cors helmet morgan compression
npm install bcryptjs jsonwebtoken cookie-parser
npm install express-rate-limit express-validator
npm install @prisma/client
npm install -D @types/node @types/express typescript ts-node nodemon
```

**Create `apps/api/package.json`:**
```json
{
  "name": "@tutorconnect/api",
  "scripts": {
    "dev": "nodemon src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "@prisma/client": "latest"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.17",
    "nodemon": "^3.0.1",
    "ts-node": "^10.9.1"
  }
}
```

### **Step 2.2: Basic Express Server**
**Create `apps/api/src/app.ts`:**
```typescript
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test database connection
app.get('/api/v1/test', async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    const subjectCount = await prisma.subject.count();
    
    res.json({
      message: 'Database connected!',
      stats: {
        users: userCount,
        subjects: subjectCount
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Get all subjects (test endpoint)
app.get('/api/v1/subjects', async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      where: { isActive: true },
      orderBy: { category: 'asc' }
    });
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
});
```

### **Step 2.3: Authentication Endpoints**
**Create `apps/api/src/routes/auth.ts`:**
```typescript
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, userType } = req.body;
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        userType
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userType: true
      }
    });
    
    res.status(201).json({ 
      message: 'User created successfully',
      user 
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login endpoint  
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email, userType: user.userType },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
```

**Update `apps/api/src/app.ts` to include auth routes:**
```typescript
// Add this after other imports
import authRouter from './routes/auth';

// Add this after middleware
app.use('/api/v1/auth', authRouter);
```

### **Step 2.4: Test Phase 2**
```bash
# Start the API server
cd apps/api
npm run dev

# Test in another terminal or use Postman/Insomnia
curl http://localhost:3001/health
curl http://localhost:3001/api/v1/test
curl http://localhost:3001/api/v1/subjects

# Test registration
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","firstName":"John","lastName":"Doe","userType":"student"}'

# Test login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**✅ Success Criteria**: 
- Health check returns status "ok"
- Database test shows user/subject counts
- Registration creates new user
- Login returns JWT token

---

## ⚛️ **Phase 3: Basic Frontend (Day 3-4)**
**Result**: React app connects to API and shows data

### **Step 3.1: Next.js Setup**
```bash
cd apps/web
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src
npm install axios @tanstack/react-query zustand
npm install -D @types/node
```

### **Step 3.2: API Client Setup**
**Create `apps/web/lib/api.ts`:**
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  timeout: 10000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
```

### **Step 3.3: Basic Pages**
**Create `apps/web/app/page.tsx`:**
```typescript
'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Subject {
  id: string;
  name: string;
  category: string;
  description: string;
}

export default function Home() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [apiStatus, setApiStatus] = useState<string>('Loading...');

  useEffect(() => {
    // Test API connection
    api.get('/test')
      .then(response => {
        setApiStatus(`✅ API Connected! Users: ${response.data.stats.users}, Subjects: ${response.data.stats.subjects}`);
      })
      .catch(() => {
        setApiStatus('❌ API Connection Failed');
      });

    // Fetch subjects
    api.get('/subjects')
      .then(response => {
        setSubjects(response.data);
      })
      .catch(error => {
        console.error('Failed to fetch subjects:', error);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎓 TutorConnect
          </h1>
          <p className="text-xl text-gray-600">
            Connecting Students with Expert Tutors
          </p>
        </div>

        {/* API Status */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">🔌 System Status</h2>
          <p className="text-lg">{apiStatus}</p>
        </div>

        {/* Subjects List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-4">📚 Available Subjects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((subject) => (
              <div key={subject.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg">{subject.name}</h3>
                  <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded">
                    {subject.category}
                  </span>
                </div>
                <p className="text-gray-600 text-sm">{subject.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Create `apps/web/.env.local`:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

### **Step 3.4: Test Phase 3**
```bash
# Make sure API is running
cd apps/api && npm run dev

# In another terminal, start frontend
cd apps/web && npm run dev
```

**✅ Success Criteria**: 
- Frontend loads at http://localhost:3000
- Shows "API Connected" with user/subject counts
- Displays list of subjects with categories
- No console errors

---

## 🔐 **Phase 4: Authentication UI (Day 4-5)**
**Result**: Login/Register forms that work with API

### **Step 4.1: Auth Store**
**Create `apps/web/store/authStore.ts`:**
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: 'student' | 'parent' | 'tutor';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, token) => {
        localStorage.setItem('token', token);
        set({ user, token, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
```

### **Step 4.2: Auth Pages**
**Create `apps/web/app/auth/login/page.tsx`:**
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', formData);
      login(response.data.user, response.data.token);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to your TutorConnect account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Don't have an account?{' '}
            <a href="/auth/register" className="text-blue-600 hover:underline">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Create similar register page at `apps/web/app/auth/register/page.tsx`**

### **Step 4.3: Protected Dashboard**
**Create `apps/web/app/dashboard/page.tsx`:**
```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated || !user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold">TutorConnect Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                Welcome, {user.firstName}!
              </span>
              <button
                onClick={logout}
                className="text-red-600 hover:text-red-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4">User Profile</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <p className="text-lg">{user.firstName} {user.lastName}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="text-lg">{user.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">User Type</label>
              <span className="inline-block bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded capitalize">
                {user.userType}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### **Step 4.4: Test Phase 4**
```bash
# Start both API and frontend
cd apps/api && npm run dev
cd apps/web && npm run dev
```

**Test Flow:**
1. Go to http://localhost:3000/auth/register
2. Create a new account
3. Go to http://localhost:3000/auth/login  
4. Login with your account
5. Should redirect to dashboard showing your profile

**✅ Success Criteria**: 
- Can register new user
- Can login with created account  
- Dashboard shows user info
- Logout works and redirects to login

---

## 👥 **Phase 5: Basic User Profiles (Day 5-6)**
**Result**: Different user types see different profile forms

### **Step 5.1: Profile API Endpoints**
**Create `apps/api/src/routes/profiles.ts`:**
```typescript
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get user profile
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        tuteeProfile: {
          include: {
            subjectNeeds: {
              include: {
                subject: true
              }
            }
          }
        },
        tutorProfile: {
          include: {
            subjects: {
              include: {
                subject: true
              }
            }
          }
        }
      }
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Create/update tutee profile
router.post('/tutee', authMiddleware, async (req, res) => {
  try {
    const { gradeLevel, schoolName, learningStyle, budgetMin, budgetMax } = req.body;
    
    const profile = await prisma.tuteeProfile.upsert({
      where: { userId: req.user.id },
      update: {
        gradeLevel,
        schoolName,
        learningStyle,
        budgetMin,
        budgetMax
      },
      create: {
        userId: req.user.id,
        gradeLevel,
        schoolName,
        learningStyle,
        budgetMin,
        budgetMax
      }
    });

    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save tutee profile' });
  }
});

// Create/update tutor profile
router.post('/tutor', authMiddleware, async (req, res) => {
  try {
    const { hourlyRate, bio, university, major, teachingExperienceYears } = req.body;
    
    const profile = await prisma.tutorProfile.upsert({
      where: { userId: req.user.id },
      update: {
        hourlyRate,
        bio,
        university,
        major,
        teachingExperienceYears
      },
      create: {
        userId: req.user.id,
        hourlyRate,
        bio,
        university,
        major,
        teachingExperienceYears
      }
    });

    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save tutor profile' });
  }
});

export default router;
```

**Add auth middleware `apps/api/src/middleware/auth.ts`:**
```typescript
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

interface AuthRequest extends Request {
  user?: any;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};
```

### **Step 5.2: Profile Components**
**Create `apps/web/components/TuteeProfileForm.tsx`:**
```typescript
'use client';

import { useState } from 'react';
import api from '@/lib/api';

interface TuteeProfileFormProps {
  profile?: any;
  onSave: () => void;
}

export default function TuteeProfileForm({ profile, onSave }: TuteeProfileFormProps) {
  const [formData, setFormData] = useState({
    gradeLevel: profile?.gradeLevel || '',
    schoolName: profile?.schoolName || '',
    learningStyle: profile?.learningStyle || 'visual',
    budgetMin: profile?.budgetMin || '',
    budgetMax: profile?.budgetMax || ''
  });
  
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/profiles/tutee', formData);
      alert('Profile saved successfully!');
      onSave();
    } catch (error) {
      alert('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">Student Profile</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Grade Level
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            value={formData.gradeLevel}
            onChange={(e) => setFormData({...formData, gradeLevel: e.target.value})}
          >
            <option value="">Select Grade</option>
            <option value="9th Grade">9th Grade</option>
            <option value="10th Grade">10th Grade</option>
            <option value="11th Grade">11th Grade</option>
            <option value="12th Grade">12th Grade</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            School Name
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            value={formData.schoolName}
            onChange={(e) => setFormData({...formData, schoolName: e.target.value})}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Budget Min ($)
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={formData.budgetMin}
              onChange={(e) => setFormData({...formData, budgetMin: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Budget Max ($)
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={formData.budgetMax}
              onChange={(e) => setFormData({...formData, budgetMax: e.target.value})}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
```

**Create similar `TutorProfileForm.tsx`**

### **Step 5.3: Enhanced Dashboard**
**Update `apps/web/app/dashboard/page.tsx` to include profile forms based on user type**

### **Step 5.4: Test Phase 5**
**✅ Success Criteria**: 
- Students see tutee profile form
- Tutors see tutor profile form
- Can save profile data
- Profile data persists after refresh

---

## 🔍 **Phase 6: Basic Search (Day 6-7)**
**Result**: Students can search and view tutor profiles

### **Step 6.1: Search API**
**Create `apps/api/src/routes/search.ts`:**
```typescript
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Search tutors
router.get('/tutors', authMiddleware, async (req, res) => {
  try {
    const { subject, minRate, maxRate, page = 1, limit = 10 } = req.query;
    
    const where: any = {
      isVerified: true,
      user: {
        isActive: true
      }
    };

    if (minRate || maxRate) {
      where.hourlyRate = {};
      if (minRate) where.hourlyRate.gte = parseFloat(minRate as string);
      if (maxRate) where.hourlyRate.lte = parseFloat(maxRate as string);
    }

    if (subject) {
      where.subjects = {
        some: {
          subject: {
            name: {
              contains: subject as string,
              mode: 'insensitive'
            }
          }
        }
      };
    }

    const tutors = await prisma.tutorProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImageUrl: true
          }
        },
        subjects: {
          include: {
            subject: {
              select: {
                name: true,
                category: true
              }
            }
          }
        }
      },
      orderBy: {
        ratingAverage: 'desc'
      },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string)
    });

    const total = await prisma.tutorProfile.count({ where });

    res.json({
      tutors,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to search tutors' });
  }
});

export default router;
```

### **Step 6.2: Search Component**
**Create `apps/web/components/TutorSearch.tsx`:**
```typescript
'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface Tutor {
  id: string;
  hourlyRate: number;
  bio: string;
  ratingAverage: number;
  totalReviews: number;
  user: {
    firstName: string;
    lastName: string;
  };
  subjects: Array<{
    subject: {
      name: string;
      category: string;
    };
  }>;
}

export default function TutorSearch() {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    subject: '',
    minRate: '',
    maxRate: ''
  });

  const searchTutors = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.subject) params.append('subject', filters.subject);
      if (filters.minRate) params.append('minRate', filters.minRate);
      if (filters.maxRate) params.append('maxRate', filters.maxRate);

      const response = await api.get(`/search/tutors?${params}`);
      setTutors(response.data.tutors);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchTutors();
  }, []);

  return (
    <div className="space-y-6">
      {/* Search Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Find Tutors</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            <input
              type="text"
              placeholder="e.g. SAT Math"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={filters.subject}
              onChange={(e) => setFilters({...filters, subject: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Rate ($)
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={filters.minRate}
              onChange={(e) => setFilters({...filters, minRate: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Rate ($)
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={filters.maxRate}
              onChange={(e) => setFilters({...filters, maxRate: e.target.value})}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={searchTutors}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tutors.map((tutor) => (
          <div key={tutor.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">
                  {tutor.user.firstName} {tutor.user.lastName}
                </h3>
                <div className="flex items-center text-sm text-gray-600">
                  <span>⭐ {tutor.ratingAverage.toFixed(1)}</span>
                  <span className="mx-1">•</span>
                  <span>{tutor.totalReviews} reviews</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-600">
                  ${tutor.hourlyRate}/hr
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex flex-wrap gap-1">
                {tutor.subjects.map((ts, index) => (
                  <span
                    key={index}
                    className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                  >
                    {ts.subject.name}
                  </span>
                ))}
              </div>
            </div>

            {tutor.bio && (
              <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                {tutor.bio}
              </p>
            )}

            <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
              View Profile
            </button>
          </div>
        ))}
      </div>

      {tutors.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          No tutors found. Try adjusting your search criteria.
        </div>
      )}
    </div>
  );
}
```

### **Step 6.3: Test Phase 6**
**✅ Success Criteria**: 
- Can search tutors by subject
- Can filter by price range
- Shows tutor cards with basic info
- Search works without errors

---

## 📋 **Quick Setup Commands Summary**

```bash
# Phase 1: Foundation
mkdir tutor-matching && cd tutor-matching
docker-compose up -d postgres
npm run db:setup

# Phase 2: API
cd apps/api && npm run dev

# Phase 3: Frontend  
cd apps/web && npm run dev

# Test everything
curl http://localhost:3001/health
# Visit http://localhost:3000
```

## 🎯 **Next Steps After Phase 6**

Once you complete these 6 phases, you'll have:
- ✅ Working database with sample data
- ✅ REST API with authentication
- ✅ React frontend with auth flow
- ✅ User profiles for different types
- ✅ Basic tutor search functionality

**Ready for advanced features**:
- Session booking system
- Payment integration (Stripe)
- Real-time messaging
- Video integration (Zoom)
- Advanced matching algorithms

Each phase builds on the previous one and gives you working, testable functionality. Perfect for iterative development and showing progress! 🚀

Ready to start with Phase 1? 