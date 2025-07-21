# 🔐 Authentication Test Guide

## Current Issue
The "session expired" error when accessing `/dashboard/messages` and `/dashboard/sessions` occurs because the user is not authenticated.

## ✅ Quick Fix Steps

### 1. Test Authentication Status
Visit: `http://localhost:3000/test-auth`
- This page will show your current authentication status
- Check if you're logged in or not

### 2. Login Process
If not authenticated:
1. Go to: `http://localhost:3000/login`
2. Choose either:
   - **Google OAuth**: Click "Sign in with Google"
   - **Magic Link**: Enter your email and click "Send Magic Link"

### 3. Complete Onboarding (New Users)
After login, you'll be redirected to:
- `/onboarding` - Choose your role (Student/Tutor)
- `/profile/setup` - Complete your profile information

### 4. Test Dashboard Access
Once authenticated and profile is complete:
- Visit: `http://localhost:3000/dashboard`
- Try accessing: `/dashboard/messages` and `/dashboard/sessions`

## 🔧 Technical Details

### Authentication Flow
1. **Frontend**: Uses Supabase Auth (Google OAuth + Magic Link)
2. **Backend**: Validates Supabase access tokens
3. **API Client**: Automatically attaches tokens to requests
4. **Protected Routes**: Require valid authentication

### Environment Setup
- ✅ Frontend: Supabase URL and Anon Key configured
- ✅ Backend: Supabase URL and Service Role Key configured
- ✅ Database: Connected to Supabase PostgreSQL

### Debug Information
- **Test Page**: `http://localhost:3000/test-auth`
- **API Health**: `http://localhost:3001/health`
- **Frontend**: `http://localhost:3000`

## 🐛 Common Issues

### "Session expired" Error
**Cause**: User not authenticated or token expired
**Solution**: Login again via `/login`

### "Invalid token" Error
**Cause**: Backend can't verify Supabase token
**Solution**: Check API environment variables

### "Network Error"
**Cause**: API server not running
**Solution**: Start API with `npm run dev` in `apps/api`

## 🎯 Expected Behavior

After successful authentication:
- ✅ Dashboard loads with navigation
- ✅ All dashboard tabs accessible
- ✅ API calls work with proper authentication
- ✅ User profile and settings accessible

## 📝 Testing Checklist

- [ ] Visit `/test-auth` and verify authentication status
- [ ] Login via `/login` (Google or Magic Link)
- [ ] Complete onboarding if new user
- [ ] Access `/dashboard` successfully
- [ ] Navigate to `/dashboard/messages` without errors
- [ ] Navigate to `/dashboard/sessions` without errors
- [ ] Test other dashboard features

## 🚀 Next Steps

Once authentication is working:
1. Test all dashboard features
2. Verify API calls are working
3. Test the complete user flow
4. Report any remaining issues 