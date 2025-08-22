# Authentication Remediation Guide

This document outlines the recurring authentication issues in the LocalAI Admin Dashboard frontend and provides step-by-step remediation procedures and prevention measures.

## 🚨 Problem Description

**Issue**: Frontend services intermittently use anonymous Supabase client access instead of authenticated user sessions, causing:
- CORS blocking from Supabase REST API
- Row Level Security (RLS) policies preventing data access
- WebSocket/realtime subscription failures
- Documents appearing to upload but not being visible to users
- General authentication-related service failures

**Root Cause**: Services directly use `supabase.auth.getUser()` or `supabase` client without proper authentication verification, defaulting to anonymous access when sessions are invalid or expired.

## 🔧 Remediation Steps

### Step 1: Identify Affected Services
Look for these patterns in service files:
```typescript
// ❌ PROBLEMATIC PATTERNS
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error('Not authenticated');

// Direct supabase client usage without auth check
const { data, error } = await supabase.from('table').select('*');

// Session checks without proper validation
const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData?.session) { /* error handling */ }
```

### Step 2: Apply Authentication Utilities
Replace problematic patterns with centralized utilities:

```typescript
// ✅ CORRECT PATTERN
import { withAuthentication, requireAuthentication } from '@/lib/supabase-auth-utils';

// For database operations
const result = await withAuthentication(async (user) => {
  return await supabase.from('table').select('*').eq('user_id', user.id);
}, 'operationContext');

// For simple auth verification
const user = await requireAuthentication();
```

### Step 3: Update Service Files
Apply authentication utilities to these file types:
- `/src/hooks/use-*.ts` - React Query hooks
- `/src/services/*.ts` - Service layer files  
- `/src/lib/*.ts` - Utility libraries
- `/src/components/**/*.tsx` - Components with direct Supabase calls

### Step 4: Verify Authentication Flow
1. Check that all database queries use authenticated sessions
2. Ensure RLS policies can identify the user (`auth.uid()`)
3. Verify WebSocket subscriptions use authenticated channels
4. Test that file uploads associate with the correct user

## 🛡️ Prevention Measures

### 1. Automated Testing

**Authentication Test Suite** (`src/__tests__/auth-compliance.test.ts`):
```typescript
describe('Authentication Compliance', () => {
  test('All service methods use authentication', async () => {
    // Test that services properly handle unauthenticated state
    // Test that authenticated operations use correct user context
  });
  
  test('Supabase queries include user context', async () => {
    // Verify RLS policies work with authenticated queries
  });
  
  test('No anonymous database access', async () => {
    // Ensure all DB operations require authentication
  });
});
```

### 2. ESLint Rules

Add custom ESLint rules to detect problematic patterns:
```json
{
  "rules": {
    "no-direct-supabase-auth": "error",
    "require-auth-wrapper": "error"
  }
}
```

### 3. Code Review Checklist

Before merging any PR that touches authentication:
- [ ] All Supabase client usage wrapped with authentication utilities
- [ ] No direct `supabase.auth.getUser()` calls in service layers
- [ ] Database queries include user context for RLS
- [ ] Error handling for authentication failures
- [ ] Tests verify authenticated behavior

### 4. Development Guidelines

**DO ✅**:
- Use `withAuthentication()` for all database operations
- Use `requireAuthentication()` for auth verification
- Include operation context strings for debugging
- Handle authentication errors gracefully
- Test with both authenticated and unauthenticated states

**DON'T ❌**:
- Use `supabase.auth.getUser()` directly in services
- Make database queries without user context
- Assume authentication state is valid
- Skip error handling for auth failures
- Mix anonymous and authenticated access patterns

## 🔍 Detection Methods

### Manual Audit
```bash
# Search for problematic patterns
grep -r "supabase.auth.getUser" src/
grep -r "supabase.from" src/ | grep -v "withAuthentication"
grep -r "getSession" src/
```

### Automated Detection
Run the authentication compliance test suite:
```bash
npm test auth-compliance
```

### Runtime Monitoring
Monitor for authentication errors in browser console:
- "User not authenticated" errors
- "PGRST116" RLS policy violations
- CORS errors from Supabase REST API
- WebSocket connection failures

## 📋 Quick Fix Checklist

When authentication issues occur:

1. **Identify the failing service**:
   - Check browser console for errors
   - Look for "User not authenticated" messages
   - Check network tab for 401/403 responses

2. **Apply the fix**:
   - Import authentication utilities
   - Wrap database operations with `withAuthentication()`
   - Replace direct auth calls with `requireAuthentication()`

3. **Test the fix**:
   - Verify user can see their data
   - Check that RLS policies work
   - Test both authenticated and unauthenticated states

4. **Prevent recurrence**:
   - Add test coverage for the fixed service
   - Update documentation if needed
   - Review related services for similar patterns

## 🏥 Emergency Recovery

If authentication completely breaks:

1. **Check Supabase configuration**:
   ```typescript
   // Verify client setup in src/lib/supabase.ts
   console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
   console.log('Has Anon Key:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
   ```

2. **Verify user session**:
   ```typescript
   const { data } = await supabase.auth.getSession();
   console.log('Session valid:', !!data?.session);
   ```

3. **Check RLS policies**:
   - Ensure policies exist for all tables
   - Verify policies use `auth.uid()` correctly
   - Test policies with authenticated user

4. **Test authentication flow**:
   - Log in as a test user
   - Verify session persistence
   - Check that services work with authenticated session

## 📚 Reference Links

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [React Auth Patterns](https://supabase.com/docs/guides/auth/auth-helpers/react)

---

**Last Updated**: 2025-01-19
**Version**: 1.0
**Next Review**: When authentication issues occur again