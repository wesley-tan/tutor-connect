# Backend Review and Improvement Plan

## Current Issues

1. **API Connectivity Issues**
   - Network errors when fetching `/sessions`, `/conversations`, `/tutors`
   - Possible CORS or middleware configuration problems
   - Inconsistent error handling between frontend and backend

2. **Type Safety Issues**
   - Mismatches between Prisma schema and TypeScript types
   - Inconsistent handling of null vs undefined
   - Incorrect type assertions in middleware

3. **Authentication Problems**
   - Supabase token verification issues
   - Inconsistent auth middleware usage
   - Missing proper error responses for auth failures

4. **Data Model Issues**
   - Inconsistent naming in Prisma schema (e.g., tutorSubjects vs subjects)
   - Complex relationships causing type errors
   - Missing or incorrect foreign key constraints

## Immediate Actions

1. **API Server Setup**
   ```typescript
   // apps/api/src/index.ts
   import cors from 'cors';
   import { json } from 'express';
   import { errorHandler } from './middleware/errorHandlers';

   const app = express();

   // CORS configuration
   app.use(cors({
     origin: process.env.FRONTEND_URL || 'http://localhost:3000',
     credentials: true
   }));

   // Basic middleware
   app.use(json());
   app.use(requestLogger);

   // Routes
   app.use('/api/v1/sessions', authenticateSupabaseToken, sessionsRouter);
   app.use('/api/v1/conversations', authenticateSupabaseToken, conversationsRouter);
   app.use('/api/v1/tutors', authenticateSupabaseToken, tutorsRouter);

   // Error handling
   app.use(errorHandler);
   ```

2. **Authentication Middleware**
   ```typescript
   // apps/api/src/utils/supabaseAuth.ts
   import { createClient } from '@supabase/supabase-js';
   import { Request, Response, NextFunction } from 'express';

   const supabase = createClient(
     process.env.SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_KEY!
   );

   export const authenticateSupabaseToken = async (
     req: Request,
     res: Response,
     next: NextFunction
   ) => {
     try {
       const token = req.headers.authorization?.split(' ')[1];
       if (!token) {
         return res.status(401).json({ error: 'No token provided' });
       }

       const { data: { user }, error } = await supabase.auth.getUser(token);
       if (error || !user) {
         return res.status(401).json({ error: 'Invalid token' });
       }

       req.user = user;
       next();
     } catch (error) {
       res.status(401).json({ error: 'Authentication failed' });
     }
   };
   ```

3. **Error Handling**
   ```typescript
   // apps/api/src/middleware/errorHandlers.ts
   export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
     logger.error(err);

     if (err instanceof ValidationError) {
       return res.status(400).json({
         error: err.message,
         code: 'VALIDATION_ERROR'
       });
     }

     if (err instanceof NotFoundError) {
       return res.status(404).json({
         error: err.message,
         code: 'NOT_FOUND'
       });
     }

     res.status(500).json({
       error: 'Internal server error',
       code: 'INTERNAL_ERROR'
     });
   };
   ```

## Architectural Improvements

1. **Service Layer**
   - Create service classes for business logic
   - Move database operations out of routes
   - Implement proper dependency injection

2. **Type Safety**
   - Generate types from Prisma schema
   - Use strict TypeScript configuration
   - Add runtime type validation with Zod

3. **Testing**
   - Unit tests for services
   - Integration tests for API endpoints
   - E2E tests for critical flows

4. **Monitoring**
   - Add request logging
   - Implement error tracking
   - Set up performance monitoring

## Implementation Plan

1. **Phase 1: Core Infrastructure (Day 1-2)**
   - Fix CORS and basic middleware
   - Implement proper error handling
   - Set up logging and monitoring
   - Fix authentication middleware

2. **Phase 2: Data Layer (Day 3-4)**
   - Update Prisma schema
   - Generate correct types
   - Implement service layer
   - Add data validation

3. **Phase 3: API Endpoints (Day 5-6)**
   - Refactor route handlers
   - Add proper error responses
   - Implement missing endpoints
   - Add request validation

4. **Phase 4: Testing & Documentation (Day 7)**
   - Write unit tests
   - Add API documentation
   - Create test data
   - Set up CI/CD

## Code Quality Standards

1. **TypeScript**
   - Use strict mode
   - No any types
   - Proper error handling
   - Clear type definitions

2. **API Design**
   - RESTful endpoints
   - Consistent response format
   - Proper status codes
   - Comprehensive validation

3. **Testing**
   - Unit tests for services
   - Integration tests for APIs
   - E2E tests for flows
   - Test coverage > 80%

4. **Documentation**
   - API documentation
   - Code comments
   - Setup instructions
   - Deployment guide

## Next Steps

1. **Immediate**
   - Fix CORS configuration
   - Update authentication middleware
   - Add proper error handling
   - Fix type errors in routes

2. **Short Term**
   - Implement service layer
   - Add comprehensive testing
   - Update Prisma schema
   - Add monitoring

3. **Long Term**
   - Add caching layer
   - Implement rate limiting
   - Add API versioning
   - Set up CI/CD pipeline


Error fetching sessions: {}

src/app/dashboard/sessions/page.tsx (62:15) @ fetchSessions


  60 |       setSessions(response.data.data || []);
  61 |     } catch (error: any) {
> 62 |       console.error('Error fetching sessions:', error);
     |               ^
  63 |       setError(error.message || 'Failed to fetch sessions');
  64 |       toast.error(error.message || 'Failed to fetch sessions');
  65 |     } finally {
Call Stack
4

Show 3 ignore-listed frame(s)
fetchSessions
src/app/dashboard/sessions/page.tsx (62:15)

Error fetching sessions: {}

src/app/dashboard/sessions/page.tsx (62:15) @ fetchSessions


  60 |       setSessions(response.data.data || []);
  61 |     } catch (error: any) {
> 62 |       console.error('Error fetching sessions:', error);
     |               ^
  63 |       setError(error.message || 'Failed to fetch sessions');
  64 |       toast.error(error.message || 'Failed to fetch sessions');
  65 |     } finally {
Call Stack
4

Show 3 ignore-listed frame(s)
fetchSessions
src/app/dashboard/sessions/page.tsx (62:15)

Would you like me to start implementing any of these improvements? 

Error fetching student requests: {}

src/app/dashboard/tutors/page.tsx (143:15) @ fetchStudentRequests


  141 |       setFilteredRequests(response.data.data || []);
  142 |     } catch (error) {
> 143 |       console.error('Error fetching student requests:', error);
      |               ^
  144 |       // Fallback to empty array
  145 |       setStudentRequests([]);
  146 |       setFilteredRequests([]);
Call Stack
4

Hide 3 ignore-listed frame(s)
createConsoleError
../../node_modules/next/src/next-devtools/shared/console-error.ts (16:35)
handleConsoleError
../../node_modules/next/src/next-devtools/userspace/app/errors/use-error-handler.ts (35:31)
console.error
../../node_modules/next/src/next-devtools/userspace/app/errors/intercept-console-error.ts (33:27)
fetchStudentRequests
src/app/dashboard/tutors/page.tsx (143:15)

