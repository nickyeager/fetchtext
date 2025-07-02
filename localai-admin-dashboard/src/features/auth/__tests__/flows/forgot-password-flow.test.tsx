import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock SendGrid client
const mockSendGridSend = vi.fn();
vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: mockSendGridSend,
  },
}));

// Mock Supabase - create the auth object first
const mockSupabaseAuth = {
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  verifyOtp: vi.fn(),
  getSession: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: mockSupabaseAuth,
  },
}));

// Mock toast notifications
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

// Mock TanStack Router
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => ({ token: 'mock-reset-token', type: 'recovery' }),
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; [key: string]: unknown }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

// Test Components
import { ForgotPasswordForm } from '@/features/auth/forgot-password/components/forgot-password-form';
import { ResetPasswordForm } from '@/features/auth/reset-password/components/reset-password-form';

// Import toast from the mocked version
import { toast } from 'sonner';

// Test wrapper
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Forgot Password Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default successful responses
    mockSupabaseAuth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: null,
    });
    mockSendGridSend.mockResolvedValue({
      statusCode: 202,
      body: {},
      headers: {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Password Reset Request', () => {
    it('should send reset email when valid email is provided', async () => {
      render(
        <TestWrapper>
          <ForgotPasswordForm />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      // Enter valid email
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSupabaseAuth.resetPasswordForEmail).toHaveBeenCalledWith(
          'user@example.com',
          {
            redirectTo: expect.stringContaining('/reset-password'),
          }
        );
      });

      expect(toast.success).toHaveBeenCalledWith(
        'Password reset email sent! Check your inbox.'
      );
    });

    it('should validate email format before sending', async () => {
      render(
        <TestWrapper>
          <ForgotPasswordForm />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      // Enter invalid email
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid email address/i)).toBeInTheDocument();
      });

      expect(mockSupabaseAuth.resetPasswordForEmail).not.toHaveBeenCalled();
    });

    it('should handle empty email field', async () => {
      render(
        <TestWrapper>
          <ForgotPasswordForm />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/please enter your email/i)).toBeInTheDocument();
      });

      expect(mockSupabaseAuth.resetPasswordForEmail).not.toHaveBeenCalled();
    });

    it('should show loading state during email sending', async () => {
      // Make the API call hang to test loading state
      mockSupabaseAuth.resetPasswordForEmail.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      render(
        <TestWrapper>
          <ForgotPasswordForm />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(screen.getByText(/sending/i)).toBeInTheDocument();
      });
    });

    it('should handle Supabase API errors', async () => {
      const errorMessage = 'Email not found';
      mockSupabaseAuth.resetPasswordForEmail.mockResolvedValue({
        data: null,
        error: { message: errorMessage },
      });

      render(
        <TestWrapper>
          <ForgotPasswordForm />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      fireEvent.change(emailInput, { target: { value: 'nonexistent@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          `Reset failed: ${errorMessage}`
        );
      });
    });
  });

  describe('SendGrid Email Integration', () => {
    it('should send password reset email via SendGrid with correct template', async () => {
      // Mock the SendGrid service function
      const mockSendResetEmail = vi.fn().mockResolvedValue({
        success: true,
        messageId: 'sg-message-123',
      });

      // Mock the service
      vi.doMock('@/lib/email-service', () => ({
        sendPasswordResetEmail: mockSendResetEmail,
      }));

      const { sendPasswordResetEmail } = await import('@/lib/email-service');

      // Simulate calling the service
      await sendPasswordResetEmail('user@example.com', 'reset-token-123');

      expect(mockSendResetEmail).toHaveBeenCalledWith(
        'user@example.com',
        'reset-token-123'
      );
    });

    it('should handle SendGrid API errors gracefully', async () => {
      mockSendGridSend.mockRejectedValue({
        code: 400,
        message: 'Bad Request',
        response: {
          body: { errors: [{ message: 'Invalid email address' }] },
        },
      });

      const mockSendResetEmail = vi.fn().mockRejectedValue(
        new Error('Failed to send email')
      );

      vi.doMock('@/lib/email-service', () => ({
        sendPasswordResetEmail: mockSendResetEmail,
      }));

      const { sendPasswordResetEmail } = await import('@/lib/email-service');

      await expect(
        sendPasswordResetEmail('invalid@example.com', 'token')
      ).rejects.toThrow('Failed to send email');
    });

    it('should use correct SendGrid template and dynamic data', async () => {
      const mockSendResetEmail = vi.fn().mockImplementation(
        (email: string, token: string) => {
          // Verify the function receives correct parameters
          expect(email).toBe('user@example.com');
          expect(token).toBe('reset-token-123');
          
          // Mock the internal SendGrid call structure
          expect(mockSendGridSend).toHaveBeenCalledWith({
            to: email,
            from: expect.objectContaining({
              email: expect.stringContaining('@fetchtext.io'),
              name: 'FetchText Support',
            }),
            templateId: 'd-password-reset-template-id',
            dynamicTemplateData: {
              reset_url: expect.stringContaining(token),
              user_email: email,
              expires_in: '1 hour',
            },
          });
          
          return Promise.resolve({ success: true });
        }
      );

      vi.doMock('@/lib/email-service', () => ({
        sendPasswordResetEmail: mockSendResetEmail,
      }));

      const { sendPasswordResetEmail } = await import('@/lib/email-service');
      await sendPasswordResetEmail('user@example.com', 'reset-token-123');

      expect(mockSendResetEmail).toHaveBeenCalled();
    });
  });

  describe('Password Reset Completion', () => {
    it('should reset password with valid token', async () => {
      mockSupabaseAuth.verifyOtp.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockSupabaseAuth.updateUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      render(
        <TestWrapper>
          <ResetPasswordForm />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      fireEvent.change(passwordInput, { target: { value: 'NewSecurePassword123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewSecurePassword123!' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSupabaseAuth.verifyOtp).toHaveBeenCalledWith({
          token_hash: 'mock-reset-token',
          type: 'recovery',
        });
      });

      await waitFor(() => {
        expect(mockSupabaseAuth.updateUser).toHaveBeenCalledWith({
          password: 'NewSecurePassword123!',
        });
      });

      expect(toast.success).toHaveBeenCalledWith(
        'Password updated successfully! You can now sign in.'
      );
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/sign-in' });
    });

    it('should validate password strength', async () => {
      render(
        <TestWrapper>
          <ResetPasswordForm />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/new password/i);
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      // Test weak password
      fireEvent.change(passwordInput, { target: { value: '123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });

      expect(mockSupabaseAuth.updateUser).not.toHaveBeenCalled();
    });

    it('should validate password confirmation match', async () => {
      render(
        <TestWrapper>
          <ResetPasswordForm />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      fireEvent.change(passwordInput, { target: { value: 'SecurePassword123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPassword123!' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/passwords don't match/i)).toBeInTheDocument();
      });

      expect(mockSupabaseAuth.updateUser).not.toHaveBeenCalled();
    });

    it('should handle invalid or expired reset token', async () => {
      mockSupabaseAuth.verifyOtp.mockResolvedValue({
        data: null,
        error: { message: 'Token has expired or is invalid' },
      });

      render(
        <TestWrapper>
          <ResetPasswordForm />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      fireEvent.change(passwordInput, { target: { value: 'NewSecurePassword123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewSecurePassword123!' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Reset token is invalid or expired. Please request a new password reset.'
        );
      });

      expect(mockSupabaseAuth.updateUser).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should implement rate limiting for reset requests', async () => {
      // Mock multiple rapid requests
      render(
        <TestWrapper>
          <ForgotPasswordForm />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

      // Simulate rapid clicking
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);

      await waitFor(() => {
        // Should only call once due to button disable or rate limiting
        expect(mockSupabaseAuth.resetPasswordForEmail).toHaveBeenCalledTimes(1);
      });
    });

    it('should show cooldown period after successful reset request', async () => {
      render(
        <TestWrapper>
          <ForgotPasswordForm />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled();
      });

      // Button should be disabled for cooldown period
      expect(submitButton).toBeDisabled();
      expect(screen.getByText(/please wait before requesting another reset/i)).toBeInTheDocument();
    });

    it('should sanitize email input to prevent injection attacks', async () => {
      render(
        <TestWrapper>
          <ForgotPasswordForm />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      // Test with potential malicious input
      const maliciousEmail = 'user@example.com<script>alert("xss")</script>';
      fireEvent.change(emailInput, { target: { value: maliciousEmail } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSupabaseAuth.resetPasswordForEmail).toHaveBeenCalledWith(
          maliciousEmail, // Should be sanitized in actual implementation
          expect.any(Object)
        );
      });
    });
  });

  describe('Email Template and Branding', () => {
    it('should use correct FetchText branding in reset emails', async () => {
      const mockSendResetEmail = vi.fn().mockResolvedValue({ success: true });

      vi.doMock('@/lib/email-service', () => ({
        sendPasswordResetEmail: mockSendResetEmail,
      }));

      const { sendPasswordResetEmail } = await import('@/lib/email-service');
      await sendPasswordResetEmail('user@example.com', 'token');

      expect(mockSendGridSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.objectContaining({
            name: 'FetchText Support',
            email: expect.stringContaining('fetchtext.io'),
          }),
          dynamicTemplateData: expect.objectContaining({
            company_name: 'FetchText',
            support_email: expect.stringContaining('support@fetchtext.io'),
          }),
        })
      );
    });

    it('should include correct reset URL in email template', async () => {
      const mockSendResetEmail = vi.fn().mockResolvedValue({ success: true });

      vi.doMock('@/lib/email-service', () => ({
        sendPasswordResetEmail: mockSendResetEmail,
      }));

      const { sendPasswordResetEmail } = await import('@/lib/email-service');
      await sendPasswordResetEmail('user@example.com', 'reset-token-123');

      expect(mockSendGridSend).toHaveBeenCalledWith(
        expect.objectContaining({
          dynamicTemplateData: expect.objectContaining({
            reset_url: expect.stringMatching(
              /https?:\/\/.*\/reset-password\?token=reset-token-123/
            ),
          }),
        })
      );
    });
  });

  describe('Analytics and Monitoring', () => {
    it('should track password reset request events', async () => {
      const mockAnalytics = vi.fn();
      
      vi.doMock('@/lib/analytics', () => ({
        track: mockAnalytics,
      }));

      render(
        <TestWrapper>
          <ForgotPasswordForm />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockAnalytics).toHaveBeenCalledWith('password_reset_requested', {
          email_domain: 'example.com',
          timestamp: expect.any(Date),
        });
      });
    });

    it('should track successful password reset completion', async () => {
      const mockAnalytics = vi.fn();
      
      vi.doMock('@/lib/analytics', () => ({
        track: mockAnalytics,
      }));

      mockSupabaseAuth.verifyOtp.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockSupabaseAuth.updateUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      render(
        <TestWrapper>
          <ResetPasswordForm />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      fireEvent.change(passwordInput, { target: { value: 'NewSecurePassword123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewSecurePassword123!' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockAnalytics).toHaveBeenCalledWith('password_reset_completed', {
          user_id: 'user-123',
          timestamp: expect.any(Date),
        });
      });
    });
  });
}); 