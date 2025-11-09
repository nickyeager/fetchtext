---
description: 'Next.js + Tailwind development standards and instructions'
applyTo: '**/*.tsx, **/*.ts, **/*.jsx, **/*.js, **/*.css'
---

# Next.js + Tailwind Development Instructions

Instructions for high-quality Next.js applications with Tailwind CSS styling and TypeScript.

## Project Context

- Latest Next.js (App Router)
- TypeScript for type safety
- Tailwind CSS for styling

## Development Standards

### Architecture
- App Router with server and client components
- Group routes by feature/domain
- Implement proper error boundaries
- Use React Server Components by default
- Leverage static optimization where possible

### TypeScript
- Strict mode enabled
- Clear type definitions
- Proper error handling with type guards
- Zod for runtime type validation

### Styling
- Tailwind CSS with consistent color palette
- Responsive design patterns
- Dark mode support
- Follow container queries best practices
- Maintain semantic HTML structure

### State Management
- React Server Components for server state
- React hooks for client state
- Proper loading and error states
- Optimistic updates where appropriate

### Data Fetching
- Server Components for direct database queries
- React Suspense for loading states
- Proper error handling and retry logic
- Cache invalidation strategies

### Security
- Input validation and sanitization
- Proper authentication checks
- CSRF protection
- Rate limiting implementation
- Secure API route handling

### Performance
- Image optimization with next/image
- Font optimization with next/font
- Route prefetching
- Proper code splitting
- Bundle size optimization

## Implementation Process
1. Plan component hierarchy
2. Define types and interfaces
3. Implement server-side logic
4. Build client components
5. Add proper error handling
6. Implement responsive styling
7. Add loading states
8. Write tests

## Playwright End-to-End Testing Policy

When modifying any code that can affect user flows (routes, components, state, styling impacting interactions) or when editing any existing Playwright spec files:

- Always run the Playwright test suite locally after changes: `npx playwright test`.
- Never commit changes to Playwright spec files (`*.pw.spec.ts`) without a successful local run (no skipped tests unless intentionally marked and justified in a code comment).
- Do not mock network/data at the Playwright layer unless an external dependency is flaky or nondeterministic; prefer real client-side behavior against the running preview/dev server.
- Keep tests resilient: prefer `data-testid` or accessible roles over brittle text selectors; avoid time-based `waitForTimeout`—use assertions and `waitForFunction`.
- If adding helpers, place them under `tests/e2e/utils/` and keep them framework-agnostic (no app imports that could bundle application code into the test process).
- When a failing test is fixed by altering application code, explain the user-observable behavior being asserted in the commit message.
- If a test must be quarantined, rename with `.quarantine.pw.spec.ts` and open a tracking issue; remove quarantine promptly once stabilized.

Baseline Commands:
- Full run: `npx playwright test`
- Single spec: `npx playwright test tests/e2e/02-basic-app-shell.pw.spec.ts`
- Debug: `npx playwright test --debug`

Artifacts (screenshots, traces, videos) should be inspected for any intermittent failures before merging significant UI changes.
