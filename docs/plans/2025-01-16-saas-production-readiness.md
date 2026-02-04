# SaaS Production Readiness Plan

**Date:** 2025-01-16
**Goal:** Make FetchText demo-ready for technical colleagues (Product Demo + Investment/Partnership Pitch)

---

## Section 1: Critical Fixes

### 1.1 Dashboard Overhaul
**Problem:** Current dashboard shows fake SaaS metrics ("Total Revenue $45,231", "Subscriptions +2350", "Recent Sales")

**Solution:** Replace with real FetchText metrics:
- Documents processed (total, this month)
- Templates created/used
- Extraction success rate
- Recent document activity (replaces "Recent Sales")
- Quick actions: Upload document, Create template

**Files to modify:**
- `localai-admin-dashboard/src/features/dashboard/index.tsx`
- `localai-admin-dashboard/src/features/dashboard/components/overview.tsx`
- `localai-admin-dashboard/src/features/dashboard/components/recent-sales.tsx` → rename/replace

### 1.2 Broken Footer Links
**Problem:** Footer links to `/docs`, `/api`, `/privacy`, `/about`, `/contact`, `/blog` - none exist

**Solution:** Create pages or remove non-essential links:
- `/privacy` - Create (Section 1.3)
- `/terms` - Create (Section 1.3)
- `/api` - Create (Section 4)
- `/about`, `/blog`, `/contact` - Remove or create minimal placeholders

**Files to modify:**
- `localai-admin-dashboard/src/features/landing/landing-page-v2.tsx` (footer section)

### 1.3 Legal Pages
**Problem:** No Terms of Service or Privacy Policy pages

**Solution:** Create simple legal pages:
- `/terms` - Standard SaaS terms of service
- `/privacy` - Standard privacy policy

**Files to create:**
- `localai-admin-dashboard/src/routes/terms.tsx`
- `localai-admin-dashboard/src/routes/privacy.tsx`

### 1.4 Footer Year
**Problem:** Footer says "© 2024"

**Solution:** Update to "© 2025" or use dynamic year

**Files to modify:**
- `localai-admin-dashboard/src/features/landing/landing-page-v2.tsx` (line ~457)

---

## Section 2: Homepage Demo Widget

### 2.1 Upload Widget on Landing Page
**Problem:** Landing page has static mockup; visitors can't try the product

**Solution:** Add working upload component directly on homepage:
- Drag & drop or click to upload area
- No login required for demo
- Positioned in hero section or immediately below

**Technical approach:**
- Create new `HomepageDemo` component
- Call existing `/api/enhanced-documents/process-with-ai` endpoint
- Handle CORS for unauthenticated requests

### 2.2 Processing Indicator
**Solution:** Show clear feedback during extraction:
- Upload progress
- "Extracting text...", "Identifying fields..." states
- Spinner/progress animation

### 2.3 Results Display
**Solution:** Display extracted fields in clean card format:
- Field name + extracted value pairs
- Confidence indicators (optional)
- "Sign up to save results" CTA

**Files to create:**
- `localai-admin-dashboard/src/features/landing/components/homepage-demo.tsx`

**Files to modify:**
- `localai-admin-dashboard/src/features/landing/landing-page-v2.tsx`

---

## Section 3: Business Credibility

### 3.1 Pricing CTAs
**Problem:** Pricing buttons don't do anything

**Solution:** Wire up CTAs:
- "Get Started" (Free tier) → `/sign-up`
- "Buy License" (Pro tier) → Contact form or mailto link
- "Contact Sales" (Enterprise) → Contact form or mailto link

**Files to modify:**
- `localai-admin-dashboard/src/features/landing/landing-page-v2.tsx` (PricingCard component)

### 3.2 Contact Link
**Problem:** No way to contact

**Solution:** Add `nick@fetchtext.io` as contact method:
- In footer "Contact" link
- In pricing "Contact Sales" button
- Optionally create simple `/contact` page

### 3.3 Remove False Social Proof
**Problem:** CTA section claims "Join hundreds of organizations processing millions of documents"

**Solution:** Remove or soften this claim until there's real traction

**Location:** `landing-page-v2.tsx` line ~391-392

---

## Section 4: API Documentation

### 4.1 Styled API Reference Page
**Problem:** Footer links to `/api` but page doesn't exist. Swagger docs exist at backend `/docs` but not styled.

**Solution:** Create `/api` page matching site design:
- Overview of API capabilities
- Authentication (API key format `ftxt_*`)
- Key endpoints with examples:
  - POST `/api/v1/process` - Process document
  - GET `/api/v1/jobs/{job_id}` - Get job status
  - POST `/api/v1/templates/generate` - Generate template
- Code examples (curl, JavaScript, Python)
- Link to full Swagger docs

**Files to create:**
- `localai-admin-dashboard/src/routes/api.tsx`
- `localai-admin-dashboard/src/features/api-docs/index.tsx` (main component)

**Reference:** Existing `document-processor/API_ENDPOINTS.md` has content to adapt

---

## Implementation Order

**Phase 1 - Quick Wins (remove embarrassments):**
1. Fix footer year (1.4)
2. Remove false social proof claim (3.3)
3. Wire up pricing CTAs with mailto links (3.1, 3.2)
4. Fix/remove broken footer links (1.2)

**Phase 2 - Legal & Credibility:**
5. Create Terms page (1.3)
6. Create Privacy page (1.3)

**Phase 3 - Dashboard:**
7. Replace fake dashboard with real metrics (1.1)

**Phase 4 - Demo Experience:**
8. Build homepage demo widget (2.1, 2.2, 2.3)

**Phase 5 - API Docs:**
9. Create styled API reference page (4.1)

---

## Success Criteria

After implementation, a technical colleague visiting the site should:
- [ ] See a working demo on the homepage (upload → extracted results)
- [ ] See a real dashboard with actual usage metrics
- [ ] Find Terms and Privacy pages
- [ ] Be able to contact via email
- [ ] Find API documentation matching site design
- [ ] Not see any broken links or placeholder content
