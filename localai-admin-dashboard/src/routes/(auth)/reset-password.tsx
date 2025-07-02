import { createFileRoute } from '@tanstack/react-router';
import ResetPassword from '@/features/auth/reset-password';

export const Route = createFileRoute('/(auth)/reset-password')({
  component: ResetPassword,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token: (search.token as string) || '',
      type: (search.type as string) || 'recovery',
    };
  },
}); 