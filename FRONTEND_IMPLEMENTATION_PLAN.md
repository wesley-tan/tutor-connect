# Frontend Implementation Plan - Missing Pages & Routes

## 🎯 Overview

This document outlines the specific implementation plan for building the **4 missing dashboard pages** that are critical for MVP completion.

**Missing Routes**:
- `/dashboard/tutors` - Find Tutors
- `/dashboard/profile` - Profile Management  
- `/dashboard/sessions` - Session Management
- `/dashboard/messages` - Real-time Messaging

---

## 📋 Implementation Priority & Timeline

### **Priority 1** (Days 1-2): Core User Journey
1. **`/dashboard/tutors`** - Find Tutors Page
2. **`/dashboard/profile`** - Profile Management Page

### **Priority 2** (Days 3-4): Booking Functionality  
3. **`/dashboard/sessions`** - Session Management Page

### **Priority 3** (Days 5-6): Communication
4. **`/dashboard/messages`** - Messaging System

---

## 🔍 PAGE 1: Find Tutors (`/dashboard/tutors`)

### **Purpose**: Browse and search qualified tutors with filtering

### **File Structure**:
```
apps/web/src/app/dashboard/tutors/
├── page.tsx                 # Main tutors listing page
├── [id]/
│   └── page.tsx            # Individual tutor profile page
└── components/
    ├── TutorSearchFilters.tsx
    ├── TutorCard.tsx
    ├── TutorList.tsx
    └── TutorProfileModal.tsx
```

### **Main Page Component** (`page.tsx`):
```typescript
'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import TutorSearchFilters from './components/TutorSearchFilters';
import TutorList from './components/TutorList';
import api from '@/lib/api';

interface TutorSearchParams {
  subject?: string;
  minRating?: number;
  maxHourlyRate?: number;
  availability?: string;
  page: number;
  limit: number;
}

export default function TutorsPage() {
  const { user } = useAuthStore();
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useState<TutorSearchParams>({
    page: 1,
    limit: 12
  });

  const fetchTutors = async (params: TutorSearchParams) => {
    try {
      setLoading(true);
      const response = await api.get('/tutors', { params });
      setTutors(response.data.data);
    } catch (error) {
      console.error('Failed to fetch tutors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTutors(searchParams);
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Find Tutors</h1>
        <p className="text-gray-600">Browse qualified tutors for your academic needs</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <TutorSearchFilters 
            onFilterChange={setSearchParams}
            currentParams={searchParams}
          />
        </div>
        
        <div className="lg:col-span-3">
          <TutorList 
            tutors={tutors}
            loading={loading}
            onPageChange={(page) => setSearchParams(prev => ({ ...prev, page }))}
          />
        </div>
      </div>
    </div>
  );
}
```

### **Required Components**:

#### **TutorSearchFilters.tsx**:
```typescript
interface FilterProps {
  onFilterChange: (params: TutorSearchParams) => void;
  currentParams: TutorSearchParams;
}

export default function TutorSearchFilters({ onFilterChange, currentParams }: FilterProps) {
  // Subject filter dropdown
  // Price range slider
  // Rating filter
  // Availability filter
  // Clear filters button
}
```

#### **TutorCard.tsx**:
```typescript
interface TutorCardProps {
  tutor: {
    id: string;
    user: { firstName: string; lastName: string; profileImageUrl?: string };
    hourlyRate: number;
    ratingAverage: number;
    totalReviews: number;
    subjects: Array<{ subject: { name: string } }>;
    bio?: string;
  };
}

export default function TutorCard({ tutor }: TutorCardProps) {
  // Profile image
  // Name and rating
  // Hourly rate
  // Subjects taught
  // Short bio
  // "View Profile" and "Contact" buttons
}
```

### **API Integration**:
- **GET** `/api/v1/tutors` - Search tutors with filters
- **GET** `/api/v1/tutors/:id` - Get individual tutor profile

---

## 👤 PAGE 2: Profile Management (`/dashboard/profile`)

### **Purpose**: Manage user profile and account settings

### **File Structure**:
```
apps/web/src/app/dashboard/profile/
├── page.tsx                 # Main profile page with tabs
└── components/
    ├── BasicProfileForm.tsx
    ├── StudentProfileForm.tsx
    ├── TutorProfileForm.tsx
    ├── PasswordChangeForm.tsx
    └── ProfileImageUpload.tsx
```

### **Main Page Component** (`page.tsx`):
```typescript
'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent } from '@/components/ui/Card';
import BasicProfileForm from './components/BasicProfileForm';
import StudentProfileForm from './components/StudentProfileForm';
import TutorProfileForm from './components/TutorProfileForm';
import PasswordChangeForm from './components/PasswordChangeForm';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('basic');

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: '👤' },
    { 
      id: 'profile', 
      label: user?.userType === 'tutor' ? 'Tutor Profile' : 'Learning Profile',
      icon: user?.userType === 'tutor' ? '🎓' : '📚' 
    },
    { id: 'security', label: 'Security', icon: '🔒' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        <p className="text-gray-600">Manage your account information and preferences</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <Card>
        <CardContent className="p-6">
          {activeTab === 'basic' && <BasicProfileForm />}
          {activeTab === 'profile' && (
            user?.userType === 'tutor' ? <TutorProfileForm /> : <StudentProfileForm />
          )}
          {activeTab === 'security' && <PasswordChangeForm />}
        </CardContent>
      </Card>
    </div>
  );
}
```

### **Required Components**:

#### **BasicProfileForm.tsx**:
```typescript
// Form fields:
// - First Name, Last Name
// - Email (read-only)
// - Phone number
// - Profile image upload
// - Timezone selection
```

#### **TutorProfileForm.tsx**:
```typescript
// Form fields:
// - Bio/Description
// - Hourly rate
// - Education (university, major, graduation year)
// - Teaching experience
// - Subjects taught (multi-select)
// - Certifications
// - Availability schedule
```

#### **StudentProfileForm.tsx**:
```typescript
// Form fields:
// - Grade level
// - School name
// - Learning style preference
// - Budget range
// - Subjects needed (multi-select)
// - Learning goals
// - Preferred session length
```

### **API Integration**:
- **GET** `/api/v1/users/profile` - Get current user profile
- **PUT** `/api/v1/users/profile` - Update basic profile
- **POST** `/api/v1/users/tutor-profile` - Create/update tutor profile
- **POST** `/api/v1/users/tutee-profile` - Create/update student profile
- **PUT** `/api/v1/auth/password` - Change password

---

## 📅 PAGE 3: Session Management (`/dashboard/sessions`)

### **Purpose**: View and manage tutoring sessions

### **File Structure**:
```
apps/web/src/app/dashboard/sessions/
├── page.tsx                 # Main sessions page
└── components/
    ├── SessionCalendar.tsx
    ├── SessionCard.tsx
    ├── SessionHistory.tsx
    ├── BookingModal.tsx
    └── SessionFilters.tsx
```

### **Main Page Component** (`page.tsx`):
```typescript
'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import SessionCalendar from './components/SessionCalendar';
import SessionHistory from './components/SessionHistory';
import api from '@/lib/api';

type ViewMode = 'upcoming' | 'calendar' | 'history';

export default function SessionsPage() {
  const { user } = useAuthStore();
  const [viewMode, setViewMode] = useState<ViewMode>('upcoming');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    try {
      const response = await api.get('/sessions');
      setSessions(response.data.data);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Sessions</h1>
          <p className="text-gray-600">
            {user?.userType === 'tutor' 
              ? 'Manage your teaching sessions' 
              : 'Track your tutoring sessions'
            }
          </p>
        </div>
        
        {/* View Mode Toggle */}
        <div className="flex rounded-md shadow-sm">
          {[
            { id: 'upcoming', label: 'Upcoming', icon: '📅' },
            { id: 'calendar', label: 'Calendar', icon: '🗓️' },
            { id: 'history', label: 'History', icon: '📝' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setViewMode(mode.id as ViewMode)}
              className={`
                px-4 py-2 text-sm font-medium border
                ${viewMode === mode.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }
                ${mode.id === 'upcoming' ? 'rounded-l-md' : ''}
                ${mode.id === 'history' ? 'rounded-r-md' : ''}
              `}
            >
              <span className="mr-2">{mode.icon}</span>
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'upcoming' && (
        <UpcomingSessions sessions={sessions} loading={loading} />
      )}
      {viewMode === 'calendar' && (
        <SessionCalendar sessions={sessions} />
      )}
      {viewMode === 'history' && (
        <SessionHistory sessions={sessions} />
      )}
    </div>
  );
}
```

### **API Integration**:
- **GET** `/api/v1/sessions` - Get user's sessions
- **POST** `/api/v1/sessions` - Book new session
- **PUT** `/api/v1/sessions/:id` - Update session
- **DELETE** `/api/v1/sessions/:id` - Cancel session

---

## 💬 PAGE 4: Messaging System (`/dashboard/messages`)

### **Purpose**: Real-time communication between tutors and students

### **File Structure**:
```
apps/web/src/app/dashboard/messages/
├── page.tsx                 # Main messages page
└── components/
    ├── ConversationList.tsx
    ├── ChatInterface.tsx
    ├── MessageBubble.tsx
    ├── FileUpload.tsx
    └── MessageSearch.tsx
```

### **Main Page Component** (`page.tsx`):
```typescript
'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import ConversationList from './components/ConversationList';
import ChatInterface from './components/ChatInterface';
import api from '@/lib/api';

export default function MessagesPage() {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    try {
      const response = await api.get('/conversations');
      setConversations(response.data.data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  return (
    <div className="h-[calc(100vh-200px)] flex">
      {/* Conversation List Sidebar */}
      <div className="w-1/3 border-r border-gray-200">
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversation?.id}
          onSelect={setSelectedConversation}
          loading={loading}
        />
      </div>

      {/* Chat Interface */}
      <div className="flex-1">
        {selectedConversation ? (
          <ChatInterface 
            conversation={selectedConversation}
            currentUser={user}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### **Real-time Integration**:
```typescript
// Socket.io integration for live messaging
useEffect(() => {
  const socket = io(process.env.NEXT_PUBLIC_API_URL);
  
  socket.on('new_message', (message) => {
    // Update conversation with new message
  });
  
  socket.on('user_typing', (data) => {
    // Show typing indicator
  });

  return () => socket.disconnect();
}, []);
```

### **API Integration**:
- **GET** `/api/v1/conversations` - Get user's conversations
- **POST** `/api/v1/conversations` - Create new conversation
- **GET** `/api/v1/messages/:conversationId` - Get conversation messages
- **POST** `/api/v1/messages` - Send new message

---

## 🧩 Additional UI Components Needed

### **Modal Component** (`components/ui/Modal.tsx`):
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  // Backdrop blur
  // ESC key handling
  // Focus trap
  // Animation
}
```

### **Dropdown Component** (`components/ui/Dropdown.tsx`):
```typescript
interface DropdownProps {
  trigger: React.ReactNode;
  items: Array<{ label: string; value: string; icon?: string }>;
  onSelect: (value: string) => void;
}

export default function Dropdown({ trigger, items, onSelect }: DropdownProps) {
  // Click outside handling
  // Keyboard navigation
  // Animation
}
```

### **Calendar Component** (`components/ui/Calendar.tsx`):
```typescript
interface CalendarProps {
  events: Array<{
    id: string;
    title: string;
    start: Date;
    end: Date;
    type: 'session' | 'availability';
  }>;
  onEventClick: (event: any) => void;
}

export default function Calendar({ events, onEventClick }: CalendarProps) {
  // Month/week/day views
  // Event rendering
  // Click handling
  // Responsive design
}
```

---

## 🔧 Implementation Checklist

### **Setup Tasks**:
- [ ] Create directory structure for each page
- [ ] Set up base components and routing
- [ ] Configure TypeScript interfaces
- [ ] Set up API integration hooks

### **Page 1 - Find Tutors**:
- [ ] Create main tutors page
- [ ] Build search filters component
- [ ] Build tutor card component
- [ ] Build tutor list with pagination
- [ ] Create individual tutor profile page
- [ ] Integrate with tutors API
- [ ] Add loading states and error handling

### **Page 2 - Profile Management**:
- [ ] Create main profile page with tabs
- [ ] Build basic profile form
- [ ] Build tutor-specific profile form
- [ ] Build student-specific profile form
- [ ] Build password change form
- [ ] Add profile image upload
- [ ] Integrate with profile APIs
- [ ] Add form validation

### **Page 3 - Session Management**:
- [ ] Create main sessions page
- [ ] Build session calendar component
- [ ] Build session cards/list
- [ ] Build booking modal
- [ ] Add session filtering
- [ ] Integrate with sessions API
- [ ] Add status management

### **Page 4 - Messaging System**:
- [ ] Create main messages page
- [ ] Build conversation list
- [ ] Build chat interface
- [ ] Build message bubbles
- [ ] Add file upload capability
- [ ] Integrate Socket.io for real-time
- [ ] Add typing indicators

### **Testing & Polish**:
- [ ] Mobile responsiveness testing
- [ ] Cross-browser testing
- [ ] Performance optimization
- [ ] Accessibility improvements
- [ ] Error boundary implementation

---

**Estimated Total Time**: 6-8 days for complete implementation
**Critical Path**: Database setup → Find Tutors → Profile Management → Sessions → Messages 