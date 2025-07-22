# Frontend-Backend Integration Review

## Current Issues

### 1. API Server Connection
- API server (port 3006) is not running or not accessible
- Frontend is configured to proxy requests to `http://localhost:3006`
- ECONNREFUSED errors indicate server is not running

### 2. Error Handling
- Non-JSON responses from server
- Internal Server Errors not properly formatted
- Missing error boundaries in frontend
- Inconsistent error response format

### 3. Authentication Flow
- Session persistence issues
- Token refresh not working properly
- Missing proper auth state management
- Supabase session not properly synced with backend

### 4. Data Models
- Inconsistent types between frontend and backend
- Missing or incorrect Prisma schema relations
- Validation mismatches between frontend and API

## Required Changes

### 1. API Server Setup
```bash
# Required Environment Variables
PORT=3006
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.fegmubgnndvxrhecnjoi.supabase.co:5432/postgres
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
COOKIE_SECRET=your_cookie_secret
FRONTEND_URL=http://localhost:3000

# Start Command (add to package.json)
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

### 2. Error Handling Standardization

#### Backend Response Format
```typescript
// Success Response
{
  success: true,
  data: T,
  message?: string
}

// Error Response
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: any
  }
}
```

#### Frontend Error Boundary
```typescript
// apps/web/src/components/ErrorBoundary.tsx
export default function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundaryComponent
      fallback={({ error }) => (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900">Error</h2>
            <p className="mt-2 text-sm text-gray-600">{error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundaryComponent>
  );
}
```

### 3. Authentication Integration

#### Backend Middleware
```typescript
// apps/api/src/middleware/auth.ts
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No token provided'
        }
      });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token'
        }
      });
    }

    // Add user to request
    (req as AuthenticatedRequest).user = user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed'
      }
    });
  }
};
```

#### Frontend Auth Store
```typescript
// apps/web/src/store/authStore.ts
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // ... existing state
      checkAuth: async () => {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) throw error;
          
          if (session) {
            // Verify with backend
            const user = await api.get('/auth/me');
            set({ 
              session,
              user: session.user,
              isAuthenticated: true
            });
          } else {
            get().resetState();
          }
        } catch (error) {
          get().resetState();
          throw error;
        }
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage)
    }
  )
);
```

### 4. API Client Configuration

```typescript
// apps/web/src/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006/api/v1';

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    const text = await response.text();
    console.error('Non-JSON response:', text);
    throw new Error('Server returned non-JSON response');
  }

  const data = await response.json();
  
  if (!response.ok) {
    if (response.status === 401) {
      useAuthStore.getState().resetState();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
    
    throw new Error(data.error?.message || response.statusText);
  }
  
  return data.data;
}

export const api = {
  get: async <T>(endpoint: string): Promise<T> => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: await getAuthHeaders(),
      credentials: 'include'
    });
    return handleResponse<T>(response);
  },
  // ... other methods
};
```

### 5. Next.js Configuration

```typescript
// apps/web/next.config.ts
export default {
  // ... other config
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3006/api/:path*'
      }
    ];
  }
};
```

## Implementation Steps

1. **API Server**
   - Ensure proper environment variables
   - Start server on port 3006
   - Verify server is running with health check

2. **Database**
   - Run Prisma migrations
   - Seed initial data if needed
   - Verify database connection

3. **Authentication**
   - Test Supabase auth flow
   - Verify token handling
   - Check session persistence

4. **Frontend Integration**
   - Update API client configuration
   - Add error boundaries
   - Test protected routes

5. **Testing**
   - Test auth flow end-to-end
   - Verify error handling
   - Check data persistence

## Common Issues

1. **ECONNREFUSED**
   - API server not running
   - Wrong port configuration
   - Environment variables missing

2. **Auth Errors**
   - Invalid/expired tokens
   - Missing CORS headers
   - Incorrect Supabase configuration

3. **Data Errors**
   - Schema mismatches
   - Missing relations
   - Validation failures

## Monitoring

1. **Frontend**
   - Console errors
   - Network requests
   - Auth state changes

2. **Backend**
   - Server logs
   - Database queries
   - Auth middleware

3. **Integration**
   - API response times
   - Error rates
   - Session management

## Security Considerations

1. **Authentication**
   - Token validation
   - Session management
   - CSRF protection

2. **API Security**
   - Rate limiting
   - Input validation
   - Error sanitization

3. **Data Protection**
   - Sensitive data handling
   - Access control
   - Audit logging 