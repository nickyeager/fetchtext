/**
 * End-to-End Email Service Testing
 * 
 * This test suite validates the complete email flow:
 * UI Component → Email Service → Supabase Edge Function → SendGrid
 * 
 * Test Coverage:
 * - Development Mode Email Service
 * - Direct Email Service Testing
 * - Error Handling
 * - Performance Testing
 */

// NOTE: Disabled for Playwright run - migrated to Vitest at src/__tests__/email/email-service.test.tsx
// Keeping file stubbed so historical references don't break. All logic commented out.
/*
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

// Mock the useNavigate hook from TanStack Router
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
  };
});

// Test data
const testEmail = 'test@fetchtext.com';
const testUserName = 'John Doe';
const testResetUrl = 'https://fetchtext.com/reset?token=abc123';
const testTwoFactorCode = '123456';

describe('Email Service End-to-End Tests', () => {
  let originalEnv: Record<string, string | boolean | undefined>;

  beforeEach(() => {
    // Store original env
    originalEnv = { ...import.meta.env };
    
    // Mock console methods to avoid spam during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore environment
    Object.assign(import.meta.env, originalEnv);
    vi.restoreAllMocks();
  });

  describe('Development Mode Email Service', () => {
    beforeEach(() => {
      // Set development mode
      import.meta.env.DEV = true;
    });

    it('should simulate password reset email in development', async () => {
      const result = await sendPasswordResetEmail(testEmail, testResetUrl);

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^dev-\d+-/);
      expect(result.error).toBeUndefined();
    });

    it('should simulate welcome email in development', async () => {
      const result = await sendWelcomeEmail(testEmail, testUserName);

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^dev-\d+-/);
      expect(result.error).toBeUndefined();
    });

    it('should simulate two-factor email in development', async () => {
      const result = await sendTwoFactorEmail(testEmail, testTwoFactorCode);

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^dev-\d+-/);
      expect(result.error).toBeUndefined();
    });

    it('should log email details in development mode', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await sendPasswordResetEmail(testEmail, testResetUrl);

      expect(consoleSpy).toHaveBeenCalledWith('📧 EMAIL SIMULATION (Development Mode)', undefined);
      expect(consoleSpy).toHaveBeenCalledWith(`To: ${testEmail}`, undefined);
      expect(consoleSpy).toHaveBeenCalledWith('Subject: Reset Your FetchText Password', undefined);
    });
  });

  describe('Email Template Generation', () => {
    it('should generate proper password reset HTML', async () => {
      const result = await sendPasswordResetEmail(testEmail, testResetUrl);
      
      // In development mode, we can test the function executes successfully
      expect(result.success).toBe(true);
    });

    it('should generate proper welcome HTML with user name', async () => {
      const result = await sendWelcomeEmail(testEmail, testUserName);
      
      expect(result.success).toBe(true);
    });

    it('should generate proper two-factor HTML with code', async () => {
      const result = await sendTwoFactorEmail(testEmail, testTwoFactorCode);
      
      expect(result.success).toBe(true);
    });
  });

  describe('UI Component Integration', () => {
    it('should render forgot password form', async () => {
      const user = userEvent.setup();
      const mockOnEmailSent = vi.fn();

      render(<ForgotPasswordForm onEmailSent={mockOnEmailSent} />);

      // Check if form renders
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();

      // Fill in the form
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, testEmail);

      expect(emailInput).toHaveValue(testEmail);
    });

    it('should integrate forgot password form with email service end-to-end', async () => {
      const user = userEvent.setup();
      const mockOnEmailSent = vi.fn();
      
      // Mock toast to avoid errors
      const mockToast = {
        success: vi.fn(),
        error: vi.fn()
      };
      vi.doMock('sonner', () => ({ toast: mockToast }));

      render(<ForgotPasswordForm onEmailSent={mockOnEmailSent} />);

      // Fill in valid email
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, testEmail);

      // Submit form
      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      // Wait for form processing and verify callback was called
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // In development mode, the email service should succeed and call onEmailSent
      expect(mockOnEmailSent).toHaveBeenCalledWith(testEmail);
    });

    it('should test email service integration with signup confirmation', async () => {
      // Test that the email service can be used for signup confirmation
      const result = await sendWelcomeEmail(testEmail, testUserName);
      
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.error).toBeUndefined();
      
      // Test that the component can be imported without errors
      expect(SignupConfirmationForm).toBeDefined();
    });
  });

  describe('Direct Edge Function Testing', () => {
    it('should test direct HTTP call to Edge Function', async () => {
      // This test would make an actual HTTP request to the Edge Function
      const edgeFunctionUrl = 'http://localhost:8000/functions/v1/send-email';
      
      const payload = {
        to: testEmail,
        subject: 'Test Email',
        html: '<h1>Test Email Content</h1>',
        template: 'password-reset'
      };

      try {
        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer test-key`
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const result = await response.json();
          expect(result.success).toBeDefined();
        } else {
          // Edge Function not available - this is expected in test environment
          expect(response.status).toBeGreaterThan(0);
        }
      } catch (_error) {
        // Expected when Edge Function is not running
        expect(true).toBe(true); // Test passes if connection fails
      }
    });
  });

  describe('Email Service Configuration', () => {
    it('should have correct service configuration', () => {
      expect(N8N_EMAIL_SERVICE_CONFIG.PROVIDER).toBe('N8N Workflows + SendGrid');
              expect(N8N_EMAIL_SERVICE_CONFIG.VERIFIED_SENDER).toBe('nick@fetchtext.io');
        expect(N8N_EMAIL_SERVICE_CONFIG.ARCHITECTURE).toBe('Frontend → N8N Webhook → SendGrid API');
        expect(N8N_EMAIL_SERVICE_CONFIG.SUPPORTED_TEMPLATES).toContain('password-reset');
        expect(N8N_EMAIL_SERVICE_CONFIG.SUPPORTED_TEMPLATES).toContain('welcome');
        expect(N8N_EMAIL_SERVICE_CONFIG.SUPPORTED_TEMPLATES).toContain('two-factor');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed email addresses', async () => {
      const invalidEmail = 'not-an-email';
      const result = await sendPasswordResetEmail(invalidEmail, testResetUrl);
      
      // Should still succeed in development mode
      expect(result.success).toBe(true);
    });

    it('should handle empty email content', async () => {
      const result = await sendEmail({
        to: testEmail,
        subject: '',
        html: '',
        template: 'password-reset'
      });
      
      expect(result.success).toBe(true);
    });

    it('should handle very long email content', async () => {
      const longContent = 'a'.repeat(100000);
      const result = await sendEmail({
        to: testEmail,
        subject: 'Long Content Test',
        html: longContent,
        template: 'password-reset'
      });
      
      expect(result.success).toBe(true);
    });

    it('should handle special characters in email content', async () => {
      const specialChars = '🎉 Special chars: <>&"\'';
      const result = await sendEmail({
        to: testEmail,
        subject: specialChars,
        html: `<p>${specialChars}</p>`,
        template: 'welcome'
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('Performance and Reliability', () => {
    it('should complete email sending within reasonable time', async () => {
      const startTime = Date.now();
      
      await sendPasswordResetEmail(testEmail, testResetUrl);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within 5 seconds (generous for development mode)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle concurrent email requests', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => 
        sendPasswordResetEmail(`test${i}@fetchtext.com`, testResetUrl)
      );
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should maintain consistent message ID format', async () => {
      const results = await Promise.all([
        sendPasswordResetEmail(testEmail, testResetUrl),
        sendWelcomeEmail(testEmail, testUserName),
        sendTwoFactorEmail(testEmail, testTwoFactorCode)
      ]);
      
      results.forEach(result => {
        expect(result.messageId).toMatch(/^dev-\d+-[a-z0-9]+$/);
      });
    });
  });

  describe('Email Service Live Integration Test', () => {
    it('should test live Edge Function if available', async () => {
      // Skip this test in CI/CD environments
      if (process.env.CI) {
        expect(true).toBe(true); // Test passes in CI
        return;
      }

      try {
        // Test if Edge Function is available
        const healthResponse = await fetch('http://localhost:8000/functions/v1/send-email', {
          method: 'OPTIONS'
        });

        if (healthResponse.ok) {
          // Test actual email sending
          const result = await sendEmail({
            to: 'test@example.com', // Use a test email
            subject: 'E2E Test Email',
            html: '<h1>This is a test email from E2E testing</h1>',
            template: 'password-reset'
          });

          expect(result).toBeDefined();
          expect(result.success).toBeDefined();
        } else {
          expect(healthResponse.status).toBeGreaterThan(0);
        }
      } catch (_error) {
        expect(true).toBe(true); // Test passes if connection fails
      }
    });
  });
}); 
*/

// Dummy export to satisfy module system
export {}; 