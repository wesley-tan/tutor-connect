# 🔧 Authentication & Dashboard Fixes

## 🐛 Current Issues

### 1. **Register Page UI Issues**
- 1Password overlay interfering with form
- User type selection could be clearer
- Form validation needs improvement

### 2. **Empty Dashboard**
- No content after successful login
- Missing navigation and features
- No user profile information

### 3. **User Type Handling**
- Tutor vs Student accounts not properly differentiated
- No role-based features
- Missing user profile setup

### 4. **Authentication Flow**
- Session management could be improved
- Better error handling needed
- Loading states need refinement

---

## 🛠️ Fixes Implementation

### **Phase 1: Fix Register Page**

#### 1.1 Improve User Type Selection
```tsx
// apps/web/src/app/(auth)/register/page.tsx
const userTypeOptions = [
  {
    value: 'student',
    label: 'Student/Parent',
    description: 'Looking for tutoring services',
    icon: '🎓',
    features: ['Find qualified tutors', 'Book sessions', 'Track progress']
  },
  {
    value: 'tutor',
    label: 'Tutor',
    description: 'Offering tutoring services',
    icon: '👨‍🏫',
    features: ['Create profile', 'Set availability', 'Earn money']
  }
];
```

#### 1.2 Enhanced Form Validation
```tsx
const registerSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  userType: z.enum(['student', 'tutor']),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional().or(z.literal('')),
  agreeToTerms: z.boolean().refine(val => val === true, 'You must agree to the terms')
});
```

#### 1.3 Better UI/UX
- Remove 1Password interference
- Add progress indicators
- Improve mobile responsiveness
- Add terms and conditions checkbox

### **Phase 2: Create User Profile System**

#### 2.1 User Profile Schema
```sql
-- Add to Prisma schema
model UserProfile {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  
  // Basic Info
  firstName String
  lastName  String
  email     String
  phone     String?
  
  // User Type Specific
  userType  UserType // 'student' | 'tutor'
  
  // Student Specific
  grade     String?
  subjects  String[] // ['math', 'science', 'english']
  goals     String?
  
  // Tutor Specific
  subjects  String[] // ['math', 'science', 'english']
  experience String?
  education String?
  hourlyRate Decimal?
  availability Json?
  
  // Common
  bio       String?
  avatar    String?
  location  String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum UserType {
  STUDENT
  TUTOR
}
```

#### 2.2 Profile Setup Flow
```tsx
// apps/web/src/app/profile/setup/page.tsx
export default function ProfileSetup() {
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  
  // Step 1: Basic Info
  // Step 2: User Type Specific Info
  // Step 3: Preferences
  // Step 4: Verification
}
```

### **Phase 3: Build Dashboard**

#### 3.1 Dashboard Layout
```tsx
// apps/web/src/app/dashboard/layout.tsx
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Find Tutors', href: '/dashboard/tutors', icon: '🔍' },
  { name: 'My Sessions', href: '/dashboard/sessions', icon: '📅' },
  { name: 'Messages', href: '/dashboard/messages', icon: '💬' },
  { name: 'Profile', href: '/dashboard/profile', icon: '👤' },
];
```

#### 3.2 Dashboard Components
```tsx
// apps/web/src/app/dashboard/page.tsx
export default function Dashboard() {
  const { user } = useAuthStore();
  const [userProfile, setUserProfile] = useState(null);
  
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <WelcomeSection user={user} profile={userProfile} />
      
      {/* Quick Actions */}
      <QuickActions userType={userProfile?.userType} />
      
      {/* Recent Activity */}
      <RecentActivity />
      
      {/* Upcoming Sessions */}
      <UpcomingSessions />
    </div>
  );
}
```

### **Phase 4: Role-Based Features**

#### 4.1 Student Dashboard
- Find tutors
- Book sessions
- Track progress
- View learning materials

#### 4.2 Tutor Dashboard
- Manage profile
- Set availability
- View bookings
- Earnings overview

### **Phase 5: Authentication Improvements**

#### 5.1 Better Session Management
```tsx
// apps/web/src/store/authStore.ts
const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // ... existing code
      
      // Add profile management
      updateProfile: async (profileData) => {
        // Update user profile
      },
      
      // Add session refresh
      refreshSession: async () => {
        const { data, error } = await supabase.auth.refreshSession();
        if (data.session) {
          set({ session: data.session, user: data.session.user });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        session: state.session,
        profile: state.profile 
      }),
    }
  )
);
```

#### 5.2 Enhanced Error Handling
```tsx
// apps/web/src/lib/authUtils.ts
export const handleAuthError = (error: any) => {
  switch (error.message) {
    case 'Invalid login credentials':
      return 'Invalid email or password';
    case 'Email not confirmed':
      return 'Please check your email and click the verification link';
    case 'Too many requests':
      return 'Too many attempts. Please try again later';
    default:
      return 'An error occurred. Please try again';
  }
};
```

---

## 🚀 Implementation Priority

### **High Priority (Week 1)**
1. ✅ Fix register page UI issues
2. ✅ Create basic dashboard layout
3. ✅ Add user profile system
4. ✅ Implement role-based navigation

### **Medium Priority (Week 2)**
1. ✅ Build student dashboard features
2. ✅ Build tutor dashboard features
3. ✅ Add session booking system
4. ✅ Implement messaging system

### **Low Priority (Week 3)**
1. ✅ Add payment integration
2. ✅ Add video conferencing
3. ✅ Add progress tracking
4. ✅ Add review system

---

## 🧪 Testing Checklist

### **Authentication Flow**
- [ ] Google OAuth works
- [ ] Email magic link works
- [ ] Registration creates proper user type
- [ ] Session persists after page refresh
- [ ] Logout works correctly

### **Dashboard Features**
- [ ] Student dashboard shows relevant content
- [ ] Tutor dashboard shows relevant content
- [ ] Navigation works correctly
- [ ] Profile setup flow works
- [ ] User type is properly stored

### **UI/UX**
- [ ] No 1Password interference
- [ ] Mobile responsive
- [ ] Loading states work
- [ ] Error messages are clear
- [ ] Success messages are shown

---

## 📝 Next Steps

1. **Start with Phase 1** - Fix register page UI
2. **Implement Phase 2** - Create user profile system
3. **Build Phase 3** - Create dashboard components
4. **Add Phase 4** - Role-based features
5. **Enhance Phase 5** - Improve authentication

### **Immediate Actions:**
1. Fix register page 1Password overlay
2. Create basic dashboard with welcome message
3. Add user profile setup flow
4. Implement role-based navigation

---

## 🔗 Related Files

- `apps/web/src/app/(auth)/register/page.tsx` - Registration form
- `apps/web/src/app/dashboard/layout.tsx` - Dashboard layout
- `apps/web/src/app/dashboard/page.tsx` - Dashboard content
- `apps/web/src/store/authStore.ts` - Auth state management
- `packages/database/prisma/schema.prisma` - Database schema

---

## 💡 Additional Ideas

### **Enhanced User Experience**
- Add onboarding tutorial
- Implement smart tutor matching
- Add progress tracking
- Create learning path recommendations

### **Advanced Features**
- Video conferencing integration
- File sharing system
- Whiteboard collaboration
- Automated scheduling

### **Monetization**
- Subscription plans
- Commission system
- Premium features
- Referral program 