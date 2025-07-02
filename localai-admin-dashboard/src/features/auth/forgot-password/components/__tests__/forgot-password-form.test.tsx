import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ForgotPasswordForm } from '../forgot-password-form';

// Mock Supabase with factory function
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
    },
  },
}));

// Mock email client
vi.mock('@/lib/email-client', () => ({
  sendPasswordResetEmail: vi.fn(),
}));

// Mock toast notifications
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Import the mocked modules
import { supabase } from '@/lib/supabase';
import { sendPasswordResetEmail } from '@/lib/email-client';
import { toast } from 'sonner';

// Type the mocked functions
const mockResetPasswordForEmail = supabase.auth.resetPasswordForEmail as ReturnType<typeof vi.fn>;
const mockSendPasswordResetEmail = sendPasswordResetEmail as ReturnType<typeof vi.fn>;
const mockToastSuccess = toast.success as ReturnType<typeof vi.fn>;
const mockToastError = toast.error as ReturnType<typeof vi.fn>;

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default successful responses
    mockSendPasswordResetEmail.mockResolvedValue({
      success: true,
      messageId: 'test-message-id',
    });
    mockResetPasswordForEmail.mockResolvedValue({
      data: {},
      error: null,
    });
  });

  it('should render form with email input and submit button', () => {
    render(<ForgotPasswordForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('should show validation error for invalid email', async () => {
    render(<ForgotPasswordForm />);

    const emailInput = screen.getByLabelText(/email/i);

    // Enter email that passes HTML5 validation but fails our custom validation
    // Use a domain without a TLD to trigger our validation while passing HTML5
    fireEvent.change(emailInput, { target: { value: 'user@domain' } });
    
    // Submit the form with fireEvent.submit to bypass HTML5 validation
    const form = emailInput.closest('form')!;
    fireEvent.submit(form);

    // Wait for the error message to appear
    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Ensure the API wasn't called
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('should show validation error for empty email', async () => {
    render(<ForgotPasswordForm />);

    const submitButton = screen.getByRole('button', { name: /send reset link/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter your email/i)).toBeInTheDocument();
    });

    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('should use SendGrid email service with valid email', async () => {
    render(<ForgotPasswordForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringMatching(/^\d+_[a-z0-9]+$/) // Token format: timestamp_randomstring
      );
    });

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Password reset email sent! Check your inbox.'
    );

    // Should not use Supabase fallback when SendGrid succeeds
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('should show loading state during submission', async () => {
    // Mock a delayed response
    mockResetPasswordForEmail.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ data: {}, error: null }), 100))
    );

    render(<ForgotPasswordForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    // Check loading state
    expect(screen.getByText(/sending/i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    // Wait for completion
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalled();
    });
  });

  it('should fallback to Supabase when SendGrid fails', async () => {
    // Mock SendGrid failure
    mockSendPasswordResetEmail.mockResolvedValue({
      success: false,
      error: 'SendGrid API error',
    });

    render(<ForgotPasswordForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSendPasswordResetEmail).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        {
          redirectTo: expect.stringContaining('/reset-password'),
        }
      );
    });

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Password reset email sent! Check your inbox.'
    );
  });

  it('should handle complete failure of both email services', async () => {
    // Mock both services failing
    mockSendPasswordResetEmail.mockResolvedValue({
      success: false,
      error: 'SendGrid API error',
    });
    
    const errorMessage = 'Email not found';
    mockResetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { message: errorMessage },
    });

    render(<ForgotPasswordForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    fireEvent.change(emailInput, { target: { value: 'nonexistent@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(`Reset failed: ${errorMessage}`);
    });
  });

  it('should implement rate limiting with cooldown', async () => {
    render(<ForgotPasswordForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    // First submission
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalled();
    });

    // Button should be disabled for cooldown
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/please wait before requesting another reset/i)).toBeInTheDocument();
  });

  it('should call onEmailSent callback when provided', async () => {
    const mockOnEmailSent = vi.fn();
    render(<ForgotPasswordForm onEmailSent={mockOnEmailSent} />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnEmailSent).toHaveBeenCalledWith('test@example.com');
    });
  });
}); 