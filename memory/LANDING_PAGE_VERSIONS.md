# Landing Page Version Management

This document describes how to switch between the original (V1) and modern (V2) landing page versions.

## Current Status
- **Active Version**: V2 (Modern shadcn-ui inspired design)
- **Location**: `src/features/landing/landing-page-v2.tsx`

## Version Descriptions

### V1 - Original Landing Page
- **File**: `src/features/landing/index.tsx` (LandingPage component)
- **Style**: Original design with basic layout
- **Status**: Preserved and ready for rollback

### V2 - Modern Landing Page  
- **File**: `src/features/landing/landing-page-v2.tsx` (LandingPageV2 component)
- **Style**: Modern shadcn-ui inspired design with:
  - Responsive navbar with mobile menu
  - Hero section with visual mockup
  - Feature cards grid
  - Security section with highlights  
  - Pricing cards (Community/Professional/Enterprise)
  - FAQ section
  - Call-to-action section
  - Footer with links

## How to Switch Between Versions

### Currently Active: V2 → V1 (Rollback)
In `src/routes/index.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
// V2 Landing Page - Modern shadcn-ui inspired design
// import { LandingPageV2 } from '@/features/landing/landing-page-v2';
// V1 Landing Page - Original design (for easy rollback)
import { LandingPage } from '@/features/landing';

export const Route = createFileRoute('/')({
  component: LandingPage,
  // To rollback to V1: Change component to LandingPage and swap the import comments above
});
```

### V1 → V2 (Switch to Modern)
In `src/routes/index.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
// V2 Landing Page - Modern shadcn-ui inspired design
import { LandingPageV2 } from '@/features/landing/landing-page-v2';
// V1 Landing Page - Original design (for easy rollback)
// import { LandingPage } from '@/features/landing';

export const Route = createFileRoute('/')({
  component: LandingPageV2,
  // To rollback to V1: Change component to LandingPage and swap the import comments above
});
```

## Testing After Switch

After switching versions, run:

1. **Development**: `pnpm dev` - Test in development mode
2. **Build Test**: `pnpm build` - Ensure production build works
3. **Type Check**: `pnpm typecheck` (if available) - Verify TypeScript types

## Files Involved

- **Route Configuration**: `src/routes/index.tsx`
- **V1 Component**: `src/features/landing/index.tsx`
- **V2 Component**: `src/features/landing/landing-page-v2.tsx`

Both versions are fully maintained and can be switched without any data loss or migration requirements.