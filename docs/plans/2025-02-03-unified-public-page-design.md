# Unified Public Page Design Plan

**Date:** 2025-02-03
**Branch:** feature/production-sync-and-billing
**Status:** Planning

## Executive Summary

This plan addresses design inconsistencies across all publicly accessible pages in the FetchText admin dashboard. The homepage has a sophisticated cyberpunk/terminal design system, but other public pages (auth, legal) use completely different layouts with missing navigation elements.

## Current State Analysis

### Screenshots Captured

**Public Pages:**
- `/tests/e2e/screenshots/homepage-full.png` - Full homepage
- `/tests/e2e/screenshots/sign-in.png` - Sign-in page
- `/tests/e2e/screenshots/sign-up.png` - Sign-up page
- `/tests/e2e/screenshots/forgot-password.png` - Forgot password page
- `/tests/e2e/screenshots/terms.png` - Terms of Service
- `/tests/e2e/screenshots/privacy.png` - Privacy Policy

**Authenticated Pages:**
- `/tests/e2e/screenshots/dashboard.png` - Main dashboard
- `/tests/e2e/screenshots/documents-list.png` - Documents/Templates list
- `/tests/e2e/screenshots/document-gallery.png` - Document gallery (grid view)
- `/tests/e2e/screenshots/document-upload.png` - Smart upload page
- `/tests/e2e/screenshots/document-detail.png` - Document detail with template editor
- `/tests/e2e/screenshots/settings.png` - Settings page

### Design Inventory

| Page | Route | Header | Footer | Theme Switch | Back Navigation |
|------|-------|--------|--------|--------------|-----------------|
| Homepage | `/` | Full nav bar | Full 4-column | ✓ | N/A |
| Sign-In | `/sign-in` | **None** | **None** | ✗ | Text link only |
| Sign-Up | `/sign-up` | **None** | **None** | ✗ | Text link only |
| Forgot Password | `/forgot-password` | **None** | **None** | ✗ | Text link only |
| Reset Password | `/reset-password` | **None** | **None** | ✗ | Text link only |
| Terms | `/terms` | Simple banner | Minimal | ✗ | "Back to Home" |
| Privacy | `/privacy` | Simple banner | Minimal | ✗ | "Back to Home" |

### Homepage Design System (Reference)

The homepage (`landing-page-v2.tsx`) establishes these design patterns:

**Navigation Bar:**
```tsx
<nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
  // Logo: Sparkles icon + "FetchText" + "V2.0" badge
  // Links: Features, Security, Pricing, FAQ (anchor links)
  // Actions: ThemeSwitch, Sign In (ghost), Get Started (primary)
  // Mobile: Hamburger menu with full navigation
</nav>
```

**Typography Patterns:**
- Section labels: `"SYSTEM CAPABILITIES"`, `"SECURITY PROTOCOL"` (uppercase, small)
- Headings with `//` prefix: `"//Everything for Document AI"`, `"//Enterprise-Grade Security"`
- Monospace/terminal aesthetic on feature badges

**Footer Structure:**
```
4-column layout:
1. Logo + tagline + status indicator
2. Product links (Features, Pricing, Documentation)
3. Legal links (Terms, Privacy)
4. Contact (email, support)

Bottom: Copyright + "MIT License"
```

**Color Tokens Used:**
- `bg-background`, `bg-background/95`
- `text-primary`, `text-muted-foreground`
- `border-b`, `border`
- Backdrop blur effects

## Identified Issues

### 1. Auth Pages Have No Site Navigation
**Problem:** Users on sign-in, sign-up, and forgot-password pages cannot easily:
- Return to homepage
- Access theme switcher
- See they're still on FetchText

**Impact:** Poor UX, users feel "trapped" on auth pages

### 2. Legal Pages Use Different Header Style
**Problem:** Terms and Privacy pages have a simplified header that doesn't match the homepage navigation style.

**Current:** Simple `<header>` with logo and "Back to Home" link
**Expected:** Consistent with homepage nav (could be simplified version)

### 3. Footer Inconsistency
**Problem:** Three different footer treatments:
- Homepage: Full 4-column footer with links
- Legal pages: Minimal footer (just copyright)
- Auth pages: No footer at all

### 4. No Theme Switch on Secondary Pages
**Problem:** Theme switch is only available on homepage. Users in dark mode who navigate to auth/legal pages can't toggle theme.

### 5. Missing Mobile Navigation on Secondary Pages
**Problem:** Homepage has responsive mobile menu, but other pages have no mobile considerations for navigation.

## Proposed Solution

### Create Shared Layout Components

#### 1. `PublicHeader` Component
A reusable header for all public (non-authenticated) pages:

```tsx
// src/components/layout/public-header.tsx

interface PublicHeaderProps {
  showFullNav?: boolean;  // Full nav (homepage) vs simplified (auth/legal)
  transparent?: boolean;  // For pages with hero sections
}

export function PublicHeader({ showFullNav = false, transparent = false }: PublicHeaderProps) {
  return (
    <nav className={cn(
      "sticky top-0 z-50 w-full border-b",
      transparent
        ? "bg-transparent"
        : "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    )}>
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo - always present */}
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">FetchText</span>
          </Link>

          {/* Full navigation - homepage only */}
          {showFullNav && (
            <div className="hidden md:flex items-center gap-8">
              <a href="#features">Features</a>
              <a href="#security">Security</a>
              <a href="#pricing">Pricing</a>
              <a href="#faq">FAQ</a>
            </div>
          )}

          {/* Actions - always present */}
          <div className="flex items-center gap-4">
            <ThemeSwitch />
            {!showFullNav && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/">← Back to Home</Link>
              </Button>
            )}
            {showFullNav && (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/sign-in">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link to="/sign-up">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
```

#### 2. `PublicFooter` Component
A reusable footer for all public pages:

```tsx
// src/components/layout/public-footer.tsx

interface PublicFooterProps {
  variant?: 'full' | 'minimal';  // Full (homepage) vs minimal (auth/legal)
}

export function PublicFooter({ variant = 'minimal' }: PublicFooterProps) {
  if (variant === 'minimal') {
    return (
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} FetchText
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link to="/terms" className="hover:text-primary">Terms</Link>
            <Link to="/privacy" className="hover:text-primary">Privacy</Link>
          </div>
        </div>
      </footer>
    );
  }

  // Full footer for homepage...
  return (/* existing 4-column footer */);
}
```

#### 3. `PublicLayout` Wrapper
A layout wrapper for all public pages:

```tsx
// src/components/layout/public-layout.tsx

interface PublicLayoutProps {
  children: React.ReactNode;
  headerVariant?: 'full' | 'simple';
  footerVariant?: 'full' | 'minimal';
  className?: string;
}

export function PublicLayout({
  children,
  headerVariant = 'simple',
  footerVariant = 'minimal',
  className
}: PublicLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicHeader showFullNav={headerVariant === 'full'} />
      <main className={cn("flex-1", className)}>
        {children}
      </main>
      <PublicFooter variant={footerVariant} />
    </div>
  );
}
```

### Page-Specific Updates

#### Auth Pages (sign-in, sign-up, forgot-password, reset-password)

**Before:**
```tsx
// auth-layout.tsx
<div className="container grid h-svh items-center justify-center">
  <div className="mx-auto flex w-full flex-col">
    <Logo />
    {children}
  </div>
</div>
```

**After:**
```tsx
// auth-layout.tsx
<PublicLayout headerVariant="simple" footerVariant="minimal">
  <div className="container grid flex-1 items-center justify-center">
    <div className="mx-auto flex w-full flex-col py-8 sm:w-[480px]">
      {children}
    </div>
  </div>
</PublicLayout>
```

**Changes:**
- Adds consistent header with logo and "Back to Home"
- Adds minimal footer with Terms/Privacy links
- Adds theme switch accessibility
- Keeps centered card layout

#### Legal Pages (terms, privacy)

**Before:** Custom header/footer in each file

**After:**
```tsx
// terms.tsx / privacy.tsx
<PublicLayout headerVariant="simple" footerVariant="minimal">
  <article className="container mx-auto px-4 py-12 max-w-3xl prose dark:prose-invert">
    <h1>Terms of Service</h1>
    {/* Content */}
  </article>
</PublicLayout>
```

**Changes:**
- Uses shared PublicLayout
- Consistent header style
- Consistent footer with links to other legal pages
- Proper prose styling for long-form content

#### Homepage

**Changes:**
- Extract header to use `PublicHeader` component with `showFullNav={true}`
- Extract footer to use `PublicFooter` component with `variant="full"`
- Keep all existing design elements

## Implementation Tasks

### Phase 1: Create Shared Components
- [ ] Create `src/components/layout/public-header.tsx`
- [ ] Create `src/components/layout/public-footer.tsx`
- [ ] Create `src/components/layout/public-layout.tsx`
- [ ] Add exports to layout index

### Phase 2: Update Auth Pages
- [ ] Modify `src/features/auth/auth-layout.tsx` to use PublicLayout
- [ ] Remove duplicate logo rendering
- [ ] Test sign-in, sign-up, forgot-password, reset-password pages
- [ ] Verify theme switch works

### Phase 3: Update Legal Pages
- [ ] Update `src/routes/terms.tsx` to use PublicLayout
- [ ] Update `src/routes/privacy.tsx` to use PublicLayout
- [ ] Ensure consistent prose styling

### Phase 4: Refactor Homepage
- [ ] Extract header from `landing-page-v2.tsx` to use PublicHeader
- [ ] Extract footer to use PublicFooter
- [ ] Verify no visual regressions

### Phase 5: Testing & Polish
- [ ] Take new screenshots of all pages
- [ ] Compare before/after
- [ ] Test mobile responsiveness
- [ ] Test theme switching on all pages
- [ ] Verify navigation flow (can get to homepage from anywhere)

## Design Decisions

### Why Keep Auth Pages Minimal?
Auth pages should be focused on the task (signing in) with minimal distractions. However, users should still be able to:
1. Return to homepage
2. Access theme switch
3. Know they're on FetchText

The simplified header provides this without overwhelming the auth flow.

### Why Not Full Navigation on Legal Pages?
Legal pages are destination pages (users don't browse from them). A simplified header with "Back to Home" is sufficient. However, they should still have:
1. Consistent branding
2. Theme switch
3. Footer with links to other legal pages

### Theme Switch Placement
Theme switch should be in the header on all pages for consistency and accessibility.

## Files to Modify

```
src/
├── components/
│   └── layout/
│       ├── public-header.tsx      # NEW
│       ├── public-footer.tsx      # NEW
│       ├── public-layout.tsx      # NEW
│       └── index.ts               # MODIFY (add exports)
├── features/
│   ├── auth/
│   │   └── auth-layout.tsx        # MODIFY
│   └── landing/
│       └── landing-page-v2.tsx    # MODIFY (extract header/footer)
└── routes/
    ├── terms.tsx                  # MODIFY (or CREATE if doesn't exist)
    └── privacy.tsx                # MODIFY (or CREATE if doesn't exist)
```

## Success Criteria

1. **Navigation Consistency:** All public pages have a header with logo and way to return home
2. **Footer Consistency:** All public pages have a footer (full or minimal)
3. **Theme Switch:** Accessible from all public pages
4. **Visual Coherence:** All pages feel like part of the same application
5. **Mobile Responsive:** Header/footer work on mobile
6. **No Regressions:** Homepage maintains exact current design

## Rollback Plan

If issues arise:
1. Revert to using page-specific layouts
2. Keep homepage unchanged
3. Components can remain as utilities for future use

## Timeline Estimate

- Phase 1: Create components (~30 min)
- Phase 2: Auth pages (~30 min)
- Phase 3: Legal pages (~20 min)
- Phase 4: Homepage refactor (~30 min)
- Phase 5: Testing (~30 min)

**Total: ~2.5 hours**
