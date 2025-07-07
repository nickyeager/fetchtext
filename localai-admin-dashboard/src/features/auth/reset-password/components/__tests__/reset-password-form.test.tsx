import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResetPasswordForm } from '../reset-password-form';

// Mock Supabase with session management
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      setSession: vi.fn(),
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

const mockGetSession = supabase.auth.getSession as ReturnType<typeof vi.fn>;
const _mockSetSession = supabase.auth.setSession as ReturnType<typeof vi.fn>;
const mockUpdateUser = supabase.auth.updateUser as ReturnType<typeof vi.fn>;
const mockToastSuccess = toast.success as ReturnType<typeof vi.fn>;
const mockToastError = toast.error as ReturnType<typeof vi.fn>;

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset window location mock
    vi.stubGlobal('location', { 
      search: '?email=test@example.com',
      hash: ''
    });

    // Mock valid session by default
    mockGetSession.mockResolvedValue({
      data: { 
        session: { 
          access_token: 'valid-token', 
          user: { email: 'test@example.com' } 
        } 
      }
    });

    mockUpdateUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
  });

  it('should render password reset form with valid session', async () => {
    render(<ResetPasswordForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
    });
  });

  it('should validate password strength', async () => {
    render(<ResetPasswordForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: '123' } });
    fireEvent.click(submitButton);

    // Look for the error text specifically in the error paragraph, not the help text
    await waitFor(() => {
      const errorElements = screen.getAllByText(/password must be at least 8 characters/i);
      const errorElement = errorElements.find(el => el.className.includes('text-red-500'));
      expect(errorElement).toBeInTheDocument();
    });
  });

  it('should validate password complexity', async () => {
    render(<ResetPasswordForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    fireEvent.change(passwordInput, { target: { value: 'weakpassword' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'weakpassword' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/password must contain uppercase, lowercase, and number/i)).toBeInTheDocument();
    });
  });

  it('should validate password confirmation match', async () => {
    render(<ResetPasswordForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    fireEvent.change(passwordInput, { target: { value: 'StrongPassword123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPassword123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/passwords don't match/i)).toBeInTheDocument();
    });
  });

  it('should successfully reset password with valid inputs', async () => {
    render(<ResetPasswordForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    fireEvent.change(passwordInput, { target: { value: 'NewStrongPassword123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'NewStrongPassword123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: 'NewStrongPassword123!',
      });
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Password updated successfully! You can now sign in.'
      );
    });
  });

  it('should handle password update error', async () => {
    mockUpdateUser.mockResolvedValue({
      data: null,
      error: { message: 'Password update failed' },
    });

    render(<ResetPasswordForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    });

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

  it('should toggle password visibility', async () => {
    render(<ResetPasswordForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    });

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

  it('should show invalid session message when no session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    render(<ResetPasswordForm />);

    await waitFor(() => {
      expect(screen.getByText(/password reset link is invalid or has expired/i)).toBeInTheDocument();
      expect(screen.getByText(/Request New Reset Link/i)).toBeInTheDocument();
    });

    // Should not show password form
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
  });
}); 