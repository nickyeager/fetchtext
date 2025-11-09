import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SignupConfirmationForm } from '../signup-confirmation-form';

// Mock Supabase with simple factory functions
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      verifyOtp: vi.fn(),
      resend: vi.fn(),
    },
  },
}));

// Mock email client (path must match component import)
vi.mock('@/lib/email-client', () => ({
  sendWelcomeEmail: vi.fn(),
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
import { sendWelcomeEmail } from '@/lib/email-client';
import { toast } from 'sonner';

const mockVerifyOtp = supabase.auth.verifyOtp as ReturnType<typeof vi.fn>;
const mockResend = supabase.auth.resend as ReturnType<typeof vi.fn>;
const mockSendWelcomeEmail = sendWelcomeEmail as ReturnType<typeof vi.fn>;
const mockToastSuccess = toast.success as ReturnType<typeof vi.fn>;
const mockToastError = toast.error as ReturnType<typeof vi.fn>;

describe('SignupConfirmationForm', () => {
  type ParamMap = Record<string, string>;
  class MockParams {
    private store: ParamMap;
    constructor(map?: ParamMap) { this.store = map || {}; }
    get(key: string) { return this.store[key] || ''; }
  }

  let currentParams: ParamMap = {};
  function setParams(map: ParamMap) { currentParams = map; }
  // @ts-expect-error override for test environment
  globalThis.URLSearchParams = class extends MockParams {
    constructor() { super(currentParams); }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setParams({});

    // Setup default successful responses
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'user@example.com', user_metadata: { full_name: 'Test User' } } },
      error: null,
    });
    mockResend.mockResolvedValue({
      data: {},
      error: null,
    });
    mockSendWelcomeEmail.mockResolvedValue({
      success: true,
      messageId: 'welcome-msg-123',
    });
  });

  it('should render pending confirmation state by default', () => {
    render(<SignupConfirmationForm />);

    expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByText(/we've sent a confirmation link/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend confirmation email/i })).toBeInTheDocument();
  });

  it('should handle resend confirmation email', async () => {
    render(<SignupConfirmationForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    const resendButton = screen.getByRole('button', { name: /resend confirmation email/i });

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(mockResend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'user@example.com',
      });
    });

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Confirmation email sent! Please check your inbox.'
    );
  });

  it('should have email input with validation', () => {
    render(<SignupConfirmationForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('required');
  });

  it('should enforce cooldown between resend attempts', async () => {
    render(<SignupConfirmationForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    const resendButton = screen.getByRole('button', { name: /resend confirmation email/i });

    // First resend
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(mockResend).toHaveBeenCalledTimes(1);
    });

    // Try to resend immediately (should be blocked)
    fireEvent.click(resendButton);
    
    expect(screen.getByText(/resend in \d+s/i)).toBeInTheDocument();
    expect(mockResend).toHaveBeenCalledTimes(1); // Should not call again
  });

  it('should handle confirmation with valid token', async () => {
  // Inject token
  setParams({ token: 'valid-token-123' });

    render(<SignupConfirmationForm />);

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        token_hash: 'valid-token-123',
        type: 'signup',
      });
    });

    await waitFor(() => {
      expect(mockSendWelcomeEmail).toHaveBeenCalledWith(
        'user@example.com',
        'Test User'
      );
    });

    expect(screen.getByText(/account confirmed!/i)).toBeInTheDocument();
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Account confirmed successfully! Welcome to FetchText.'
    );
  });

  it('should handle confirmation with valid token_hash', async () => {
  setParams({ token_hash: 'valid-hash-123' });

    render(<SignupConfirmationForm />);

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        token_hash: 'valid-hash-123',
        type: 'signup',
      });
    });

    expect(screen.getByText(/account confirmed!/i)).toBeInTheDocument();
  });

  it('should handle expired confirmation token', async () => {
  setParams({ token: 'expired-token' });

    mockVerifyOtp.mockResolvedValue({
      data: null,
      error: { message: 'Token has expired' },
    });

    render(<SignupConfirmationForm />);

    await waitFor(() => {
      expect(screen.getByText(/confirmation link expired/i)).toBeInTheDocument();
    });

    expect(mockToastError).toHaveBeenCalledWith(
      'Confirmation link is invalid or expired. Please request a new one.'
    );
  });

  it('should handle resend email errors', async () => {
    mockResend.mockResolvedValue({
      data: null,
      error: { message: 'Email sending failed' },
    });

    render(<SignupConfirmationForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    const resendButton = screen.getByRole('button', { name: /resend confirmation email/i });

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Failed to resend confirmation: Email sending failed'
      );
    });
  });

  it('should handle welcome email failure gracefully', async () => {
  setParams({ token: 'valid-token-123' });

    mockSendWelcomeEmail.mockResolvedValue({
      success: false,
      error: 'Welcome email failed',
    });

    render(<SignupConfirmationForm />);

    await waitFor(() => {
      expect(screen.getByText(/account confirmed!/i)).toBeInTheDocument();
    });

    // Confirmation should still succeed even if welcome email fails
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Account confirmed successfully! Welcome to FetchText.'
    );
  });

  it('should show loading state during confirmation', async () => {
  setParams({ token: 'valid-token-123' });

    // Mock delayed response
    mockVerifyOtp.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({
        data: { user: { id: 'user-123', email: 'user@example.com' } },
        error: null,
      }), 100))
    );

    render(<SignupConfirmationForm />);

    expect(screen.getByText(/confirming your account/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/account confirmed!/i)).toBeInTheDocument();
    });
  });

  it('should call onConfirmationComplete callback when provided', async () => {
    const mockOnConfirmationComplete = vi.fn();
    
  setParams({ token: 'valid-token-123' });

    render(<SignupConfirmationForm onConfirmationComplete={mockOnConfirmationComplete} />);

    await waitFor(() => {
      expect(mockOnConfirmationComplete).toHaveBeenCalled();
    });
  });

  it('should show dashboard button after successful confirmation', async () => {
  setParams({ token: 'valid-token-123' });

    render(<SignupConfirmationForm />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /go to dashboard/i })).toBeInTheDocument();
    });
  });

  it('should handle unexpected errors during confirmation', async () => {
    // Mock URL with token
    vi.stubGlobal('URLSearchParams', class {
      get(key: string) {
        return key === 'token' ? 'valid-token-123' : '';
      }
    });

    mockVerifyOtp.mockRejectedValue(new Error('Network error'));

    render(<SignupConfirmationForm />);

    await waitFor(() => {
      expect(screen.getByText(/confirmation failed/i)).toBeInTheDocument();
    });

    expect(mockToastError).toHaveBeenCalledWith(
      'An unexpected error occurred during confirmation'
    );
  });
}); 