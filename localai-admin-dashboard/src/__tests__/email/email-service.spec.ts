/**
 * Email Service Vitest Suite (migrated from e2e folder)
 * Maintains previous coverage but runs under Vitest/JSDOM.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { 
  sendEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendTwoFactorEmail,
  N8N_EMAIL_SERVICE_CONFIG
} from '@/lib/n8n-email-client';
import ForgotPasswordForm from '@/features/auth/forgot-password/components/forgot-password-form';
import SignupConfirmationForm from '@/features/auth/signup-confirmation/components/signup-confirmation-form';

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) };
});

const testEmail = 'test@fetchtext.com';
const testUserName = 'John Doe';
const testResetUrl = 'https://fetchtext.com/reset?token=abc123';
const testTwoFactorCode = '123456';

describe('Email Service (Vitest)', () => {
  let originalEnv: Record<string, any>;
  beforeEach(() => {
    originalEnv = { ...import.meta.env };
    import.meta.env.DEV = true;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    Object.assign(import.meta.env, originalEnv);
    vi.restoreAllMocks();
  });

  it('simulates password reset', async () => {
    const result = await sendPasswordResetEmail(testEmail, testResetUrl);
    expect(result.success).toBe(true);
  });

  it('renders forgot password form and submits', async () => {
    const user = userEvent.setup();
    const onEmailSent = vi.fn();
    render(<ForgotPasswordForm onEmailSent={onEmailSent} />);
    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, testEmail);
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    await new Promise(r => setTimeout(r, 50));
    expect(onEmailSent).toHaveBeenCalledWith(testEmail);
  });

  it('welcome + 2FA templates succeed', async () => {
    const [welcome, twoFactor] = await Promise.all([
      sendWelcomeEmail(testEmail, testUserName),
      sendTwoFactorEmail(testEmail, testTwoFactorCode)
    ]);
    expect(welcome.success && twoFactor.success).toBe(true);
  });

  it('configuration object stable', () => {
    expect(N8N_EMAIL_SERVICE_CONFIG.PROVIDER).toBe('N8N Workflows + SendGrid');
  });

  it('handles invalid email gracefully', async () => {
    const result = await sendPasswordResetEmail('bad-email', testResetUrl);
    expect(result.success).toBe(true);
  });

  it('long content send', async () => {
    const longContent = 'x'.repeat(50000);
    const result = await sendEmail({ to: testEmail, subject: 'Long', html: longContent, template: 'password-reset' });
    expect(result.success).toBe(true);
  });

  it('signup confirmation component imports', () => {
    expect(SignupConfirmationForm).toBeDefined();
  });
});
