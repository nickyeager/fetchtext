import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResetPasswordForm } from '../reset-password-form';

// Mock Supabase with simple factory functions
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      verifyOtp: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

// Mock toast notifications
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock navigation
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const mockVerifyOtp = supabase.auth.verifyOtp as ReturnType<typeof vi.fn>;
const mockUpdateUser = supabase.auth.updateUser as ReturnType<typeof vi.fn>;
const mockToastSuccess = toast.success as ReturnType<typeof vi.fn>;
const mockToastError = toast.error as ReturnType<typeof vi.fn>;

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock URL params with token
    vi.stubGlobal('URLSearchParams', class {
      get(key: string) {
        return key === 'token' ? 'valid-reset-token' : '';
      }
    });

    // Setup default successful responses
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockUpdateUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
  });

  it('should render password reset form', () => {
    render(<ResetPasswordForm />);

    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
  });

  it('should validate password strength', async () => {
    render(<ResetPasswordForm />);

    const passwordInput = screen.getByLabelText(/new password/i);
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(submitButton);

    expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
  });

  it('should validate password complexity', async () => {
    render(<ResetPasswordForm />);

    const passwordInput = screen.getByLabelText(/new password/i);
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    fireEvent.change(passwordInput, { target: { value: 'weakpassword' } });
    fireEvent.click(submitButton);

    expect(screen.getByText(/password must contain uppercase, lowercase, and number/i)).toBeInTheDocument();
  });

  it('should validate password confirmation match', async () => {
    render(<ResetPasswordForm />);

    const passwordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    fireEvent.change(passwordInput, { target: { value: 'StrongPassword123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPassword123!' } });
    fireEvent.click(submitButton);

    expect(screen.getByText(/passwords don't match/i)).toBeInTheDocument();
  });

  it('should successfully reset password with valid inputs', async () => {
    render(<ResetPasswordForm />);

    const passwordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    fireEvent.change(passwordInput, { target: { value: 'NewStrongPassword123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'NewStrongPassword123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        token_hash: 'valid-reset-token',
        type: 'recovery',
      });
    });

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: 'NewStrongPassword123!',
      });
    });

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Password updated successfully! You can now sign in.'
    );
  });

  it('should handle invalid token error', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: null,
      error: { message: 'Token expired' },
    });

    render(<ResetPasswordForm />);

    const passwordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    fireEvent.change(passwordInput, { target: { value: 'NewStrongPassword123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'NewStrongPassword123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Reset token is invalid or expired. Please request a new password reset.'
      );
    });

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('should handle password update error', async () => {
    mockUpdateUser.mockResolvedValue({
      data: null,
      error: { message: 'Password update failed' },
    });

    render(<ResetPasswordForm />);

    const passwordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    fireEvent.change(passwordInput, { target: { value: 'NewStrongPassword123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'NewStrongPassword123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Failed to update password: Password update failed'
      );
    });
  });

  it('should toggle password visibility', () => {
    render(<ResetPasswordForm />);

    const passwordInput = screen.getByLabelText(/new password/i);
    const passwordToggleButtons = screen.getAllByRole('button');
    const passwordToggle = passwordToggleButtons.find(btn => 
      btn.closest('.relative')?.contains(passwordInput)
    );

    expect(passwordInput).toHaveAttribute('type', 'password');

    if (passwordToggle) {
      fireEvent.click(passwordToggle);
      expect(passwordInput).toHaveAttribute('type', 'text');
    }
  });
}); 