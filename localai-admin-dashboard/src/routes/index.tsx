import { createFileRoute } from '@tanstack/react-router';
// V2 Landing Page - Modern shadcn-ui inspired design
import { LandingPageV2 } from '@/features/landing/landing-page-v2';
// V1 Landing Page - Original design (for easy rollback)
// import { LandingPage } from '@/features/landing';

export const Route = createFileRoute('/')({
  component: LandingPageV2,
  // To rollback to V1: Change component to LandingPage and swap the import comments above
}); 