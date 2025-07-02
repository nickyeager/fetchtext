import { createFileRoute } from '@tanstack/react-router';
import SignupConfirmation from '@/features/auth/signup-confirmation';

export const Route = createFileRoute('/(auth)/signup-confirmation')({
  component: SignupConfirmation,
});

export default SignupConfirmation; 