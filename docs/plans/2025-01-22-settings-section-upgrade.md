# Settings Section Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the settings section from placeholder/demo implementations to production-ready with real data persistence.

**Architecture:** Create a unified `SettingsService` backed by a new `user_preferences` Supabase table. Refactor all forms to use TanStack Query mutations for persistence. Remove non-functional pages (Display) and fix security vulnerabilities (localStorage credentials).

**Tech Stack:** React 19, TanStack Query, React Hook Form, Zod, Supabase (PostgreSQL + RLS), TypeScript

---

## Comprehensive Audit Summary

### Current State Analysis

| Settings Page | Status | Issue |
|---------------|--------|-------|
| **AI Models** | ✅ Production-ready | Real API integration, tests exist |
| **Appearance** | ⚠️ Partial | Theme/font work via context, no cross-device sync |
| **Profile** | ❌ Stub | `showSubmittedData()` only - no persistence |
| **Account** | ❌ Stub | `showSubmittedData()` only - no persistence |
| **Notifications** | ❌ Stub | `showSubmittedData()` only - no persistence |
| **Display** | ❌ Remove | Not useful - controls fake sidebar items |
| **Integrations** | 🔴 Broken | Route file missing, security vulnerability |

### Critical Issues Found

1. **Security Vulnerability (CRITICAL)**: Google Drive credentials stored in localStorage
   - File: `src/features/settings/integrations/google-drive-settings.tsx:64-68`
   - OAuth client secrets and service account keys in browser storage

2. **Missing Route (BROKEN)**: `/settings/integrations` route file doesn't exist
   - Sidebar links to it but clicking causes 404

3. **No Data Persistence**: 4 pages use `showSubmittedData()` which only shows a toast
   - Profile, Account, Notifications, Display forms discard all data on submit

4. **Hardcoded Demo Data**: Profile form contains shadcn boilerplate
   - Fake emails: `m@example.com`, `m@google.com`
   - Fake bio: "I own a computer."
   - Fake URLs: shadcn twitter links

5. **Test Violations**: Existing tests mock backend services (violates CLAUDE.md rules)

---

## Upgrade Categories

### Category A: Remove (Not Needed)
- [ ] Display settings page - controls nothing real
- [ ] `showSubmittedData()` utility - encourages bad patterns

### Category B: Fix Critical Issues
- [ ] Create missing integrations route
- [ ] Move Google Drive credentials to Vault/backend

### Category C: Add Real Persistence
- [ ] Create `user_preferences` database table
- [ ] Create `SettingsService` class
- [ ] Refactor Profile form with real save
- [ ] Refactor Account form with real save
- [ ] Refactor Notifications form with real save

### Category D: Improve Existing
- [ ] Sync theme/font preferences to database (cross-device)
- [ ] Replace mock Google Drive connection test with real API call
- [ ] Fix tests to not use mocks

---

## Task 1: Create User Preferences Database Table

**Files:**
- Create: `supabase/migrations/020_add_user_preferences.sql`

**Step 1: Write the migration SQL**

```sql
-- User preferences table for settings persistence
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Profile settings
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,

  -- Account settings
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  date_of_birth DATE,

  -- Appearance settings (sync from localStorage)
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  font TEXT DEFAULT 'geist',

  -- Notification preferences
  notification_type TEXT DEFAULT 'all' CHECK (notification_type IN ('all', 'mentions', 'none')),
  email_communication BOOLEAN DEFAULT FALSE,
  email_marketing BOOLEAN DEFAULT FALSE,
  email_social BOOLEAN DEFAULT FALSE,
  email_security BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT user_preferences_user_id_key UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own preferences
CREATE POLICY "Users can view own preferences" ON user_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences" ON user_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();

-- Create index for fast lookups
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
```

**Step 2: Apply migration to local Docker Supabase**

Run:
```bash
docker exec supabase-db psql -U postgres -d postgres -f /dev/stdin < supabase/migrations/020_add_user_preferences.sql
```

**Step 3: Reload PostgREST schema cache**

Run:
```bash
docker kill -s SIGUSR1 supabase-rest
```

**Step 4: Apply migration to production Supabase**

Use Supabase MCP tool or SQL Editor at https://app.supabase.com/project/rawhmcrtzfdhryyfovee/sql/new

**Step 5: Verify table exists**

Run:
```bash
docker exec supabase-db psql -U postgres -d postgres -c "\d user_preferences"
```

---

## Task 2: Create Settings Service

**Files:**
- Create: `localai-admin-dashboard/src/lib/services/settings-service.ts`
- Create: `localai-admin-dashboard/src/types/settings.ts`

**Step 1: Create types file**

```typescript
// src/types/settings.ts
export interface UserPreferences {
  id: string
  user_id: string

  // Profile
  display_name: string | null
  bio: string | null
  avatar_url: string | null

  // Account
  language: string
  timezone: string
  date_of_birth: string | null

  // Appearance
  theme: 'light' | 'dark' | 'system'
  font: string

  // Notifications
  notification_type: 'all' | 'mentions' | 'none'
  email_communication: boolean
  email_marketing: boolean
  email_social: boolean
  email_security: boolean

  created_at: string
  updated_at: string
}

export type UserPreferencesUpdate = Partial<Omit<UserPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
```

**Step 2: Create settings service**

```typescript
// src/lib/services/settings-service.ts
import { supabase } from '@/lib/supabase'
import { withAuthentication } from '@/lib/supabase-auth-utils'
import type { UserPreferences, UserPreferencesUpdate } from '@/types/settings'

class SettingsService {
  async getUserPreferences(): Promise<UserPreferences | null> {
    return withAuthentication(async (user) => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error
      }

      return data
    })
  }

  async updateUserPreferences(updates: UserPreferencesUpdate): Promise<UserPreferences> {
    return withAuthentication(async (user) => {
      const { data, error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          ...updates,
        }, {
          onConflict: 'user_id',
        })
        .select()
        .single()

      if (error) throw error
      return data
    })
  }

  async initializePreferences(): Promise<UserPreferences> {
    return withAuthentication(async (user) => {
      // Check if preferences exist
      const existing = await this.getUserPreferences()
      if (existing) return existing

      // Create default preferences
      const { data, error } = await supabase
        .from('user_preferences')
        .insert({
          user_id: user.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    })
  }
}

export const settingsService = new SettingsService()
```

**Step 3: Verify TypeScript compiles**

Run:
```bash
cd localai-admin-dashboard && npx pnpm build
```

---

## Task 3: Fix Missing Integrations Route

**Files:**
- Create: `localai-admin-dashboard/src/routes/_authenticated/settings/integrations.tsx`

**Step 1: Create the route file**

```typescript
// src/routes/_authenticated/settings/integrations.tsx
import { createFileRoute } from '@tanstack/react-router'
import Integrations from '@/features/settings/integrations'

export const Route = createFileRoute('/_authenticated/settings/integrations')({
  component: Integrations,
})
```

**Step 2: Rebuild to regenerate route tree**

Run:
```bash
cd localai-admin-dashboard && npx pnpm build
```

**Step 3: Verify route works**

Navigate to http://localhost:5173/settings/integrations - should load without 404

---

## Task 4: Remove Display Settings Page

**Files:**
- Delete: `localai-admin-dashboard/src/routes/_authenticated/settings/display.tsx`
- Delete: `localai-admin-dashboard/src/features/settings/display/` (entire directory)
- Modify: `localai-admin-dashboard/src/features/settings/index.tsx` (remove sidebar item)

**Step 1: Delete the route file**

Run:
```bash
rm localai-admin-dashboard/src/routes/_authenticated/settings/display.tsx
```

**Step 2: Delete the feature directory**

Run:
```bash
rm -rf localai-admin-dashboard/src/features/settings/display/
```

**Step 3: Remove from sidebar navigation**

In `src/features/settings/index.tsx`, remove lines 84-88:

```typescript
// REMOVE THIS BLOCK:
{
  title: 'Display',
  icon: <IconBrowser size={18} />,
  href: '/settings/display',
},
```

**Step 4: Rebuild**

Run:
```bash
cd localai-admin-dashboard && npx pnpm build
```

---

## Task 5: Refactor Profile Settings with Real Persistence

**Files:**
- Modify: `localai-admin-dashboard/src/features/settings/profile/profile-form.tsx`

**Step 1: Update imports and add hooks**

Replace the top of the file:

```typescript
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { settingsService } from '@/lib/services/settings-service'
import { Skeleton } from '@/components/ui/skeleton'
```

**Step 2: Update schema and form values**

```typescript
const profileFormSchema = z.object({
  display_name: z
    .string()
    .min(2, { message: 'Display name must be at least 2 characters.' })
    .max(50, { message: 'Display name must not be longer than 50 characters.' })
    .optional()
    .or(z.literal('')),
  bio: z
    .string()
    .max(300, { message: 'Bio must not be longer than 300 characters.' })
    .optional()
    .or(z.literal('')),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>
```

**Step 3: Replace form component with data fetching**

```typescript
export default function ProfileForm() {
  const queryClient = useQueryClient()

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: () => settingsService.getUserPreferences(),
  })

  const updateMutation = useMutation({
    mutationFn: (data: ProfileFormValues) =>
      settingsService.updateUserPreferences(data),
    onSuccess: () => {
      toast.success('Profile updated successfully')
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] })
    },
    onError: (error) => {
      toast.error(`Failed to update profile: ${error.message}`)
    },
  })

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      display_name: '',
      bio: '',
    },
    values: preferences ? {
      display_name: preferences.display_name ?? '',
      bio: preferences.bio ?? '',
    } : undefined,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-32" />
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className='space-y-8'>
        <FormField
          control={form.control}
          name='display_name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Name</FormLabel>
              <FormControl>
                <Input placeholder='Your display name' {...field} />
              </FormControl>
              <FormDescription>
                This is your public display name. It can be your real name or a
                pseudonym.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='bio'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='Tell us a little bit about yourself'
                  className='resize-none'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                A brief description about yourself. Max 300 characters.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type='submit' disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving...' : 'Update profile'}
        </Button>
      </form>
    </Form>
  )
}
```

**Step 4: Verify build passes**

Run:
```bash
cd localai-admin-dashboard && npx pnpm build
```

---

## Task 6: Refactor Account Settings with Real Persistence

**Files:**
- Modify: `localai-admin-dashboard/src/features/settings/account/account-form.tsx`

**Step 1: Update the form similarly to Profile**

The pattern is identical - use `useQuery` to fetch, `useMutation` to save, remove `showSubmittedData`.

Key changes:
- Remove hardcoded default values
- Fetch from `settingsService.getUserPreferences()`
- Save with `settingsService.updateUserPreferences()`
- Add loading skeleton
- Add error handling toast

**Step 2: Update schema to match database**

```typescript
const accountFormSchema = z.object({
  display_name: z
    .string()
    .min(2, { message: 'Name must be at least 2 characters.' })
    .max(30, { message: 'Name must not be longer than 30 characters.' }),
  date_of_birth: z.date().optional(),
  language: z.string(),
  timezone: z.string().optional(),
})
```

---

## Task 7: Refactor Notifications Settings with Real Persistence

**Files:**
- Modify: `localai-admin-dashboard/src/features/settings/notifications/notifications-form.tsx`

**Step 1: Update schema to match database**

```typescript
const notificationsFormSchema = z.object({
  notification_type: z.enum(['all', 'mentions', 'none']),
  email_communication: z.boolean().default(false),
  email_marketing: z.boolean().default(false),
  email_social: z.boolean().default(false),
  email_security: z.boolean().default(true),
})
```

**Step 2: Replace showSubmittedData with mutation**

Same pattern as Profile - `useQuery` + `useMutation` + `settingsService`.

---

## Task 8: Fix Google Drive Security Vulnerability

**Files:**
- Modify: `localai-admin-dashboard/src/features/settings/integrations/google-drive-settings.tsx`

**Step 1: Remove localStorage storage**

Delete lines 64-68 that save to localStorage.

**Step 2: Add server-side storage (future)**

For now, replace with a warning message:

```typescript
// Replace localStorage.setItem with:
toast.warning('Integration credentials are not yet persisted. Backend integration coming soon.')
```

**Step 3: Disable the form until backend is ready**

Add a note that this feature is "Coming Soon" and disable credential input fields.

---

## Task 9: Delete showSubmittedData Utility

**Files:**
- Delete: `localai-admin-dashboard/src/utils/show-submitted-data.tsx`
- Modify: Any files still importing it (verify with grep)

**Step 1: Check for remaining usages**

Run:
```bash
grep -r "showSubmittedData" localai-admin-dashboard/src/
```

**Step 2: Remove all imports and usages**

Replace with proper mutation calls or remove entirely.

**Step 3: Delete the file**

Run:
```bash
rm localai-admin-dashboard/src/utils/show-submitted-data.tsx
```

---

## Task 10: Add Integration Tests

**Files:**
- Create: `localai-admin-dashboard/tests/e2e/settings/settings-persistence.pw.spec.ts`

**Step 1: Write Playwright test for settings persistence**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Settings Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/sign-in')
    await page.fill('[name="email"]', process.env.TEST_USER_EMAIL!)
    await page.fill('[name="password"]', process.env.TEST_USER_PASSWORD!)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
  })

  test('Profile settings persist after save', async ({ page }) => {
    await page.goto('/settings')

    // Update display name
    const testName = `Test User ${Date.now()}`
    await page.fill('[name="display_name"]', testName)
    await page.click('button[type="submit"]')

    // Wait for success toast
    await expect(page.locator('text=Profile updated successfully')).toBeVisible()

    // Refresh page
    await page.reload()

    // Verify value persisted
    await expect(page.locator('[name="display_name"]')).toHaveValue(testName)
  })

  test('Account settings persist after save', async ({ page }) => {
    await page.goto('/settings/account')

    // Update language
    await page.selectOption('[name="language"]', 'es')
    await page.click('button[type="submit"]')

    // Wait for success toast
    await expect(page.locator('text=Account updated successfully')).toBeVisible()

    // Refresh and verify
    await page.reload()
    await expect(page.locator('[name="language"]')).toHaveValue('es')
  })
})
```

**Step 2: Run the tests**

Run:
```bash
cd localai-admin-dashboard && TEST_USER_EMAIL="admin@fetchtext.local" TEST_USER_PASSWORD="testpass123" npx playwright test tests/e2e/settings/
```

---

## Summary: Files to Create/Modify/Delete

### Create
| File | Purpose |
|------|---------|
| `supabase/migrations/020_add_user_preferences.sql` | Database table for settings |
| `src/types/settings.ts` | TypeScript types |
| `src/lib/services/settings-service.ts` | Settings CRUD service |
| `src/routes/_authenticated/settings/integrations.tsx` | Missing route |
| `tests/e2e/settings/settings-persistence.pw.spec.ts` | E2E tests |

### Modify
| File | Changes |
|------|---------|
| `src/features/settings/profile/profile-form.tsx` | Add real persistence |
| `src/features/settings/account/account-form.tsx` | Add real persistence |
| `src/features/settings/notifications/notifications-form.tsx` | Add real persistence |
| `src/features/settings/integrations/google-drive-settings.tsx` | Fix security issue |
| `src/features/settings/index.tsx` | Remove Display from sidebar |

### Delete
| File | Reason |
|------|--------|
| `src/routes/_authenticated/settings/display.tsx` | Not useful |
| `src/features/settings/display/` | Not useful |
| `src/utils/show-submitted-data.tsx` | Encourages bad patterns |

---

## Execution Estimate

| Phase | Tasks | Effort |
|-------|-------|--------|
| Database Setup | 1 | Task 1 |
| Service Layer | 1 | Task 2 |
| Critical Fixes | 2 | Tasks 3, 8 |
| Form Refactors | 3 | Tasks 5, 6, 7 |
| Cleanup | 2 | Tasks 4, 9 |
| Testing | 1 | Task 10 |

**Total: 10 Tasks**
