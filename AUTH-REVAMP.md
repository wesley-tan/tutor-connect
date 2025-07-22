# Authentication System Assessment and Revamp Plan

## Current State Assessment

### 1. Authentication Methods
- ✅ Supabase Auth integration for:
  - Magic Link authentication
  - Google OAuth
- ❌ Legacy JWT system still present but unused
- ❌ Mixed authentication middleware (mockAuth vs authenticateToken)

### 2. Frontend Implementation Issues
- Inconsistent auth state management
- Missing proper loading states
- No proper error boundaries for auth failures
- Registration still accessible despite being disabled
- Missing proper session persistence
- Incomplete TypeScript types for auth-related interfaces

### 3. Backend Implementation Issues
- Two competing auth implementations:
  1. `utils/auth.ts` (JWT-based, legacy)
  2. `utils/supabaseAuth.ts` (Supabase-based, current)
- Inconsistent middleware usage across routes
- Missing proper error handling for auth failures
- No rate limiting on auth endpoints
- Incomplete user creation flow in Supabase auth middleware

### 4. Security Concerns
- Missing CSRF protection
- No proper session invalidation
- Missing rate limiting on auth endpoints
- Incomplete input validation
- No proper audit logging for auth events
- Missing proper error messages sanitization

### 5. User Flow Issues
- Unclear onboarding flow
- Missing email verification enforcement
- No proper account recovery flow
- Missing proper session timeout handling
- Incomplete profile completion enforcement

## Immediate Action Items

### 1. Frontend Cleanup
```typescript
// 1. Update auth store types
interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  
  // Auth methods
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  
  // State management
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

// 2. Add proper error boundaries
// 3. Implement loading states
// 4. Add session persistence
// 5. Remove registration routes
```

### 2. Backend Cleanup
```typescript
// 1. Remove legacy JWT auth
// 2. Standardize Supabase auth middleware
// 3. Add rate limiting
// 4. Implement proper error handling
// 5. Add audit logging
```

### 3. Security Enhancements
1. Implement CSRF protection
2. Add rate limiting
3. Implement proper session management
4. Add security headers
5. Implement audit logging

## Implementation Plan

### Phase 1: Foundation (Week 1)
1. Remove legacy JWT authentication system
2. Standardize on Supabase auth across all routes
3. Implement proper error handling
4. Add basic security headers
5. Remove registration routes

### Phase 2: Security (Week 2)
1. Implement CSRF protection
2. Add rate limiting
3. Add audit logging
4. Implement proper session management
5. Add input validation

### Phase 3: User Experience (Week 3)
1. Improve error messages
2. Add loading states
3. Implement proper onboarding flow
4. Add email verification enforcement
5. Implement account recovery

### Phase 4: Monitoring & Maintenance (Week 4)
1. Add monitoring for auth failures
2. Implement automated testing
3. Add performance monitoring
4. Create documentation
5. Security review

## Required Environment Variables
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# Security
SESSION_TIMEOUT=900  # 15 minutes in seconds
REFRESH_TOKEN_TIMEOUT=604800  # 7 days in seconds
ENABLE_EMAIL_VERIFICATION=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX_REQUESTS=5
```

## Database Schema Updates
```prisma
model User {
  // Add new fields
  supabaseId      String    @unique  // Link to Supabase user
  lastLoginAt     DateTime? @map("last_login_at")
  loginCount      Int       @default(0)
  failedAttempts  Int       @default(0)
  lockedUntil     DateTime? @map("locked_until")
  
  // Add new relations
  authEvents      AuthEvent[]
  sessions        UserSession[]
}

model AuthEvent {
  id          String   @id @default(cuid())
  userId      String   @map("user_id")
  eventType   String   // login, logout, password_reset, etc.
  ipAddress   String?
  userAgent   String?
  metadata    Json?
  createdAt   DateTime @default(now())
  
  user        User     @relation(fields: [userId], references: [id])
}

model UserSession {
  id          String   @id @default(cuid())
  userId      String   @map("user_id")
  token       String   @unique
  expiresAt   DateTime
  revokedAt   DateTime?
  createdAt   DateTime @default(now())
  
  user        User     @relation(fields: [userId], references: [id])
}
```

## Testing Requirements

### Unit Tests
1. Auth store functionality
2. Auth middleware
3. Rate limiting
4. Input validation
5. Error handling

### Integration Tests
1. Login flows (Magic Link & Google)
2. Session management
3. Profile completion
4. Error scenarios
5. Rate limiting

### E2E Tests
1. Complete login flow
2. Session persistence
3. Protected routes
4. Error handling
5. Account recovery

## Monitoring & Alerts

### Metrics to Track
1. Login success/failure rates
2. Session duration
3. Rate limit hits
4. Error rates
5. Auth latency

### Alerts
1. High failure rate
2. Rate limit breaches
3. Unusual activity patterns
4. Service degradation
5. Security incidents

## Documentation Requirements

### Developer Documentation
1. Auth flow diagrams
2. API documentation
3. Error codes
4. Testing guide
5. Security guidelines

### User Documentation
1. Login instructions
2. Account recovery
3. Profile management
4. Security best practices
5. FAQ

## Future Considerations
1. Multi-factor authentication
2. Additional OAuth providers
3. Biometric authentication
4. Session management improvements
5. Advanced security features 