# TutorConnect Implementation Plan
## Complete MVP Development Roadmap

---

## 🚨 **PHASE 1: CRITICAL INFRASTRUCTURE FIXES** (Day 1)

### **Task 1.1: Fix Database Setup** ⚡ URGENT
**Problem**: Prisma client not generated, blocking backend startup
**Solution**: Generate Prisma client and set up database

```bash
# Step 1: Navigate to database package
cd packages/database

# Step 2: Generate Prisma client
npx prisma generate

# Step 3: Push schema to database (if database exists)
npx prisma db push

# Step 4: Seed database with initial data
npx prisma db seed

# Step 5: Verify setup
npx prisma studio
```

**Expected Outcome**: Backend API can start without database errors

### **Task 1.2: Update Database Schema** 🔧 HIGH PRIORITY
**Problem**: Schema still has `parent` enum but code uses simplified `student|tutor`
**Solution**: Update schema to match simplified user types

```sql
-- Update UserType enum in schema.prisma
enum UserType {
  student
  tutor
}
```

**Files to Update**:
- `packages/database/prisma/schema.prisma` - Remove `parent` from UserType enum
- `apps/api/src/schemas/auth.ts` - Already updated ✅
- `apps/api/src/routes/users.ts` - Already updated ✅

**Commands**:
```bash
cd packages/database
npx prisma db push --force-reset
npx prisma db seed
```

### **Task 1.3: Test Backend API** 🧪
**Goal**: Verify all API endpoints work correctly

```bash
# Test health endpoint
curl http://localhost:3001/health

# Test authentication
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123","firstName":"Test","lastName":"User","userType":"student"}'

# Test tutor search
curl http://localhost:3001/api/v1/tutors
```

**Success Criteria**: All endpoints return 200 status codes

---

## 🎨 **PHASE 2: CORE FRONTEND PAGES** (Days 2-4)

### **Task 2.1: Find Tutors Page** 🔍 PRIORITY 1
**Route**: `/dashboard/tutors`
**Purpose**: Browse and search qualified tutors

#### **File Structure**:
```
apps/web/src/app/dashboard/tutors/
├── page.tsx
├── [id]/
│   └── page.tsx
└── components/
    ├── TutorSearchFilters.tsx
    ├── TutorCard.tsx
    ├── TutorList.tsx
    └── TutorProfileModal.tsx
```

#### **Implementation Steps**:

**Step 1**: Create directory structure
```bash
mkdir -p apps/web/src/app/dashboard/tutors/components
mkdir -p apps/web/src/app/dashboard/tutors/[id]
```

**Step 2**: Build main page (`page.tsx`)
- Search functionality with filters
- Tutor listing with pagination
- Integration with `/api/v1/tutors` endpoint

**Step 3**: Build components
- `TutorSearchFilters`: Subject, price, rating filters
- `TutorCard`: Individual tutor display
- `TutorList`: Grid/list view with pagination
- `TutorProfileModal`: Quick profile view

**Step 4**: Add loading states and error handling
- Skeleton loading for tutor cards
- Error boundaries for API failures
- Empty state when no tutors found

#### **API Integration**:
```typescript
// GET /api/v1/tutors - Search tutors
const fetchTutors = async (params) => {
  const response = await api.get('/tutors', { params });
  return response.data.data;
};

// GET /api/v1/tutors/:id - Get tutor profile
const fetchTutorProfile = async (id) => {
  const response = await api.get(`/tutors/${id}`);
  return response.data.data;
};
```

### **Task 2.2: Profile Management Page** 👤 PRIORITY 1
**Route**: `/dashboard/profile`
**Purpose**: Manage user profile and account settings

#### **File Structure**:
```
apps/web/src/app/dashboard/profile/
├── page.tsx
└── components/
    ├── BasicProfileForm.tsx
    ├── StudentProfileForm.tsx
    ├── TutorProfileForm.tsx
    ├── PasswordChangeForm.tsx
    └── ProfileImageUpload.tsx
```

#### **Implementation Steps**:

**Step 1**: Create tabbed interface
- Basic Info tab (name, email, phone)
- Role-specific tab (tutor/student profile)
- Security tab (password change)

**Step 2**: Build form components
- `BasicProfileForm`: Common user fields
- `TutorProfileForm`: Bio, education, subjects, rates
- `StudentProfileForm`: Grade, school, subjects needed
- `PasswordChangeForm`: Secure password update

**Step 3**: Add form validation
- Zod schemas for each form
- Real-time validation feedback
- Error handling for API calls

#### **API Integration**:
```typescript
// GET /api/v1/users/profile - Get current profile
const fetchProfile = async () => {
  const response = await api.get('/users/profile');
  return response.data.data;
};

// PUT /api/v1/users/profile - Update basic profile
const updateProfile = async (data) => {
  const response = await api.put('/users/profile', data);
  return response.data.data;
};

// POST /api/v1/users/tutor-profile - Update tutor profile
const updateTutorProfile = async (data) => {
  const response = await api.post('/users/tutor-profile', data);
  return response.data.data;
};
```

### **Task 2.3: Session Management Page** 📅 PRIORITY 2
**Route**: `/dashboard/sessions`
**Purpose**: View and manage tutoring sessions

#### **File Structure**:
```
apps/web/src/app/dashboard/sessions/
├── page.tsx
└── components/
    ├── SessionCalendar.tsx
    ├── SessionCard.tsx
    ├── SessionHistory.tsx
    ├── BookingModal.tsx
    └── SessionFilters.tsx
```

#### **Implementation Steps**:

**Step 1**: Create view modes
- Upcoming sessions list
- Calendar view
- Session history

**Step 2**: Build session components
- `SessionCard`: Individual session display
- `SessionCalendar`: Calendar with session events
- `BookingModal`: Book new sessions
- `SessionFilters`: Filter by status, date, tutor

**Step 3**: Add session actions
- Book new session
- Reschedule existing session
- Cancel session
- Join video call

#### **API Integration**:
```typescript
// GET /api/v1/sessions - Get user's sessions
const fetchSessions = async () => {
  const response = await api.get('/sessions');
  return response.data.data;
};

// POST /api/v1/sessions - Book new session
const bookSession = async (data) => {
  const response = await api.post('/sessions', data);
  return response.data.data;
};
```

### **Task 2.4: Messaging System** 💬 PRIORITY 3
**Route**: `/dashboard/messages`
**Purpose**: Real-time communication

#### **File Structure**:
```
apps/web/src/app/dashboard/messages/
├── page.tsx
└── components/
    ├── ConversationList.tsx
    ├── ChatInterface.tsx
    ├── MessageBubble.tsx
    ├── FileUpload.tsx
    └── MessageSearch.tsx
```

#### **Implementation Steps**:

**Step 1**: Build conversation list
- List all conversations
- Unread message indicators
- Last message preview

**Step 2**: Build chat interface
- Message bubbles
- Typing indicators
- File upload capability
- Message search

**Step 3**: Add real-time features
- Socket.io integration
- Live message updates
- Online status indicators

#### **API Integration**:
```typescript
// GET /api/v1/conversations - Get conversations
const fetchConversations = async () => {
  const response = await api.get('/conversations');
  return response.data.data;
};

// GET /api/v1/messages/:conversationId - Get messages
const fetchMessages = async (conversationId) => {
  const response = await api.get(`/messages/${conversationId}`);
  return response.data.data;
};
```

---

## 🧩 **PHASE 3: UI COMPONENTS & POLISH** (Days 5-6)

### **Task 3.1: Additional UI Components**

#### **Modal Component** (`components/ui/Modal.tsx`):
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}
```

#### **Dropdown Component** (`components/ui/Dropdown.tsx`):
```typescript
interface DropdownProps {
  trigger: React.ReactNode;
  items: Array<{ label: string; value: string; icon?: string }>;
  onSelect: (value: string) => void;
}
```

#### **Calendar Component** (`components/ui/Calendar.tsx`):
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
```

### **Task 3.2: Error Handling & Loading States**
- Add error boundaries for each page
- Implement skeleton loading components
- Add toast notifications for user feedback
- Handle network errors gracefully

### **Task 3.3: Mobile Responsiveness**
- Test all pages on mobile devices
- Optimize touch interactions
- Ensure proper spacing on small screens
- Test navigation on mobile

---

## 🔧 **PHASE 4: INTEGRATION & TESTING** (Days 7-8)

### **Task 4.1: End-to-End Testing**
**User Journey Testing**:
1. User registration → Login → Dashboard
2. Find tutors → View profile → Contact
3. Book session → Manage sessions
4. Send messages → Real-time chat

### **Task 4.2: API Integration Testing**
- Test all frontend-backend connections
- Verify error handling
- Test loading states
- Validate form submissions

### **Task 4.3: Performance Optimization**
- Code splitting for large components
- Lazy loading for non-critical pages
- Optimize bundle size
- Add caching strategies

---

## 📋 **DETAILED TASK CHECKLIST**

### **Day 1: Infrastructure**
- [ ] Fix Prisma database setup
- [ ] Update database schema (remove parent type)
- [ ] Test backend API endpoints
- [ ] Verify Redis connection (optional)

### **Day 2: Find Tutors Page**
- [ ] Create directory structure
- [ ] Build main page component
- [ ] Implement search filters
- [ ] Build tutor cards
- [ ] Add pagination
- [ ] Integrate with API

### **Day 3: Profile Management**
- [ ] Create tabbed interface
- [ ] Build basic profile form
- [ ] Build role-specific forms
- [ ] Add form validation
- [ ] Implement image upload
- [ ] Integrate with API

### **Day 4: Session Management**
- [ ] Create session listing
- [ ] Build calendar component
- [ ] Implement booking modal
- [ ] Add session actions
- [ ] Integrate with API

### **Day 5: Messaging System**
- [ ] Build conversation list
- [ ] Create chat interface
- [ ] Add real-time features
- [ ] Implement file upload
- [ ] Add search functionality

### **Day 6: UI Components & Polish**
- [ ] Build Modal component
- [ ] Build Dropdown component
- [ ] Build Calendar component
- [ ] Add error boundaries
- [ ] Implement loading states

### **Day 7: Integration Testing**
- [ ] Test complete user journeys
- [ ] Verify API integrations
- [ ] Test error scenarios
- [ ] Mobile responsiveness testing

### **Day 8: Final Polish**
- [ ] Performance optimization
- [ ] Accessibility improvements
- [ ] Cross-browser testing
- [ ] Documentation updates

---

## 🎯 **SUCCESS METRICS**

### **Technical Metrics**:
- ✅ Backend API starts without errors
- ✅ All 4 dashboard pages load successfully
- ✅ User can complete full registration → booking flow
- ✅ Real-time messaging works
- ✅ Mobile responsive on all pages

### **User Experience Metrics**:
- ✅ User can find and contact tutors
- ✅ User can book and manage sessions
- ✅ User can update profile information
- ✅ User can send/receive messages

### **Business Metrics**:
- ✅ Complete MVP functionality
- ✅ Ready for user testing
- ✅ Ready for production deployment

---

## 🚀 **DEPLOYMENT READINESS**

### **Pre-Deployment Checklist**:
- [ ] All pages load without 404 errors
- [ ] Database migrations completed
- [ ] Environment variables configured
- [ ] API endpoints tested
- [ ] Error handling implemented
- [ ] Mobile responsiveness verified
- [ ] Performance optimized

### **Post-Deployment Tasks**:
- [ ] Monitor error logs
- [ ] Track user engagement
- [ ] Gather user feedback
- [ ] Plan feature iterations

---

**Estimated Timeline**: 8 days for complete MVP
**Critical Path**: Database → Find Tutors → Profile → Sessions → Messages → Polish
**Risk Mitigation**: Start with infrastructure fixes, then build pages incrementally 