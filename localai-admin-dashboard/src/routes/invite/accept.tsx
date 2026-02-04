import { createFileRoute } from '@tanstack/react-router';
import { InviteAcceptPage } from '@/features/auth/invite-accept';

export const Route = createFileRoute('/invite/accept')({
  component: InviteAcceptPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token: (search.token as string) || '',
      email: (search.email as string) || '',
    };
  },
});
