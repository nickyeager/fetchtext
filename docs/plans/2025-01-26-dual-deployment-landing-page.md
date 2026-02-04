# Dual Deployment Landing Page Design

**Date**: 2025-01-26
**Status**: Approved for implementation

---

## Overview

Update the FetchText landing page to support a unified value proposition that promotes BOTH cloud/SaaS and self-hosted deployment options equally, following the n8n/PostHog dual-track model.

## Business Model

### Pricing Structure

| Tier | Cloud | Self-Hosted |
|------|-------|-------------|
| **Free** | $0/mo - 100 docs/month, shared AI | Free forever - Unlimited, community support |
| **Pro** | $49/mo - Unlimited, email support | $499/year - Unlimited, email support |
| **Enterprise** | Custom - Dedicated + SLA | Custom - Priority support + custom dev |

### Target Users

- **Cloud users**: Want convenience, no DevOps, managed infrastructure
- **Self-hosted users**: Privacy-conscious, data sovereignty requirements, existing infrastructure

---

## UI Changes Required

### 1. Hero Section

**Before:**
- Badge: "Self-Hosted AI Platform"
- Headline: "Process Documents with Complete Privacy"
- Subtext: "Zero cloud dependencies. Your data never leaves your servers."

**After:**
- Badge: "Document AI Platform"
- Headline: "Process Documents with AI — Your Way"
- Subtext: "Extract data, automate workflows, and leverage AI—on our cloud or your infrastructure."
- **NEW**: Deployment toggle below subtext

**Deployment Toggle Component:**
```
┌─────────────────────────────────────┐
│  ☁️ Cloud    │    🖥️ Self-Hosted   │
└─────────────────────────────────────┘
```

**Dynamic CTAs:**
- Cloud mode: "Start Free" + "View Pricing"
- Self-Hosted mode: "Download" + "View Docs"

### 2. Features Section

Keep 6 feature cards. Add small relevance badges (`CLOUD`, `SELF-HOSTED`, `BOTH`).

Descriptions adapt based on toggle:

| Feature | Cloud | Self-Hosted |
|---------|-------|-------------|
| Smart Document Processing | "No setup required, managed AI" | "AI models on your infrastructure" |
| Template Intelligence | "We handle the AI" | "AI you control" |
| Workflow Automation | "Fully managed N8N" | "N8N on your servers" |
| Data Privacy | "SOC 2, encrypted" | "Never leaves your servers" |
| Multi-Model Support | "Azure OpenAI included" | "Ollama, vLLM, or BYOK" |
| Google Drive Integration | "One-click connect" | "Self-managed credentials" |

### 3. Security Section

**Two-column comparison layout:**

| Cloud Security | Self-Hosted Security |
|----------------|---------------------|
| SOC 2 Type II certified | SOC 2 compliant architecture |
| Data encrypted at rest/transit | Data never leaves your servers |
| 99.9% uptime SLA | Air-gapped deployment option |
| GDPR compliant | Full data sovereignty |
| Automatic backups | Your backup strategy |
| We handle security patches | Zero external dependencies |

**Shared compliance badges:** GDPR, HIPAA Ready, RBAC, Audit Logging

### 4. Pricing Section (Side-by-Side)

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│                      Choose Your Path                            │
├───────────────────────────┬─────────────────────────────────────┤
│        ☁️ CLOUD           │         🖥️ SELF-HOSTED              │
│    We run everything      │       You run everything            │
├───────────────────────────┼─────────────────────────────────────┤
│                           │                                     │
│  ┌─────────────────────┐  │  ┌─────────────────────┐           │
│  │ Free         $0/mo  │  │  │ Community     Free  │           │
│  │ • 100 docs/month    │  │  │ • Unlimited docs    │           │
│  │ • Shared AI         │  │  │ • Ollama (local AI) │           │
│  │ • Community forum   │  │  │ • Community forum   │           │
│  │ [Start Free]        │  │  │ [Download]          │           │
│  └─────────────────────┘  │  └─────────────────────┘           │
│                           │                                     │
│  ┌─────────────────────┐  │  ┌─────────────────────┐           │
│  │ Pro    $49/mo ★     │  │  │ Pro    $499/yr ★    │           │
│  │ • Unlimited docs    │  │  │ • Unlimited docs    │           │
│  │ • Priority AI       │  │  │ • Email support     │           │
│  │ • Email support     │  │  │ • Updates included  │           │
│  │ • Google Drive sync │  │  │ • Google Drive sync │           │
│  │ [Start Pro Trial]   │  │  │ [Buy License]       │           │
│  └─────────────────────┘  │  └─────────────────────┘           │
│                           │                                     │
│  ┌─────────────────────┐  │  ┌─────────────────────┐           │
│  │ Enterprise  Custom  │  │  │ Enterprise  Custom  │           │
│  │ • Dedicated infra   │  │  │ • Priority support  │           │
│  │ • 99.9% SLA         │  │  │ • Custom dev        │           │
│  │ • Custom integrations│  │  │ • Air-gapped deploy │           │
│  │ [Contact Sales]     │  │  │ [Contact Sales]     │           │
│  └─────────────────────┘  │  └─────────────────────┘           │
│                           │                                     │
└───────────────────────────┴─────────────────────────────────────┘
```

### 5. FAQ Section Updates

Update/add these FAQs:

1. **"Should I choose Cloud or Self-Hosted?"**
   - Cloud: Best for teams wanting zero setup, managed updates, and don't have strict data residency requirements
   - Self-Hosted: Best for organizations with compliance requirements, existing infrastructure, or data sovereignty needs

2. **"Can I switch between Cloud and Self-Hosted?"**
   - Yes, export your templates and data anytime. We provide migration tools.

3. **"What's included in the self-hosted free tier?"**
   - Everything except priority support. Run unlimited documents with Ollama AI models.

### 6. Footer Update

Change tagline from:
> "Self-hosted document AI platform with complete data privacy"

To:
> "Document AI platform — cloud or self-hosted, your choice"

---

## Technical Implementation

### State Management

Add React state to track deployment mode:
```typescript
const [deploymentMode, setDeploymentMode] = useState<'cloud' | 'self-hosted'>('cloud');
```

### Component Structure

```
LandingPageV2
├── DeploymentToggle (new)
├── HeroSection (updated - uses deploymentMode)
├── FeaturesSection (updated - descriptions change)
├── SecuritySection (updated - side-by-side comparison)
├── PricingSection (updated - side-by-side tracks)
├── FAQSection (updated - new questions)
└── Footer (updated - new tagline)
```

### New Components Needed

1. `DeploymentToggle` - Toggle switch between Cloud/Self-Hosted
2. `PricingTrack` - Column of pricing cards for one track
3. `SecurityComparison` - Two-column security features
4. `DeploymentContext` - React context to share mode across components (optional)

---

## Files to Modify

1. `localai-admin-dashboard/src/features/landing/landing-page-v2.tsx` - Main landing page
2. `localai-admin-dashboard/src/features/landing/landing.css` - Styles for new components
3. (Optional) `localai-admin-dashboard/src/features/landing/components/` - Extract new components

---

## Success Criteria

- [ ] Hero section shows unified message with deployment toggle
- [ ] Toggle switches between Cloud/Self-Hosted modes
- [ ] Features section adapts descriptions based on mode
- [ ] Security section shows side-by-side comparison
- [ ] Pricing section shows both tracks simultaneously
- [ ] CTAs point to correct destinations (signup vs download)
- [ ] FAQ addresses deployment choice question
- [ ] Footer has updated tagline
- [ ] Mobile responsive
- [ ] Maintains current industrial/technical design aesthetic
