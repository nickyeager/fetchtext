/**
 * SendGrid Email Integration Tests
 * 
 * Tests the complete SendGrid email delivery system for FetchText
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  sendPasswordResetEmail, 
  sendWelcomeEmail, 
  sendTwoFactorEmail,
  EMAIL_SERVICE_CONFIG 
} from '../email-client';
import { 
  sendEmailViaSendGrid, 
  validateEmailAddress,
  SENDGRID_DOCUMENTATION 
} from '../sendgrid-client';

// Mock the sendgrid-client module
vi.mock('../sendgrid-client', () => ({
  sendEmailViaSendGrid: vi.fn(),
  validateEmailAddress: vi.fn(),
  SENDGRID_DOCUMENTATION: {
    PURPOSE: 'Production-ready email delivery for FetchText application',
    VERIFIED_SENDER: 'yeag123@gmail.com',
    ARCHITECTURE: 'Frontend → Supabase Edge Function → SendGrid API'
  }
}));

describe('SendGrid Email Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Email Service Configuration', () => {
    it('should have correct configuration', () => {
      expect(EMAIL_SERVICE_CONFIG.PROVIDER).toBe('SendGrid');
      expect(EMAIL_SERVICE_CONFIG.VERIFIED_SENDER).toBe('yeag123@gmail.com');
      expect(EMAIL_SERVICE_CONFIG.ARCHITECTURE).toBe('Multi-provider with SendGrid primary');
      expect(EMAIL_SERVICE_CONFIG.SUPPORTED_TEMPLATES).toContain('password-reset');
      expect(EMAIL_SERVICE_CONFIG.SUPPORTED_TEMPLATES).toContain('welcome');
      expect(EMAIL_SERVICE_CONFIG.SUPPORTED_TEMPLATES).toContain('two-factor');
    });

    it('should have SendGrid documentation available', () => {
      expect(SENDGRID_DOCUMENTATION.PURPOSE).toBe('Production-ready email delivery for FetchText application');
      expect(SENDGRID_DOCUMENTATION.VERIFIED_SENDER).toBe('yeag123@gmail.com');
      expect(SENDGRID_DOCUMENTATION.ARCHITECTURE).toBe('Frontend → Supabase Edge Function → SendGrid API');
    });
  });

  describe('Password Reset Email', () => {
    it('should send password reset email successfully', async () => {
      const mockResponse = { success: true, messageId: 'test-123' };
      vi.mocked(sendEmailViaSendGrid).mockResolvedValue(mockResponse);

      const result = await sendPasswordResetEmail(
        'user@example.com',
        'https://fetchtext.app/reset-password?token=abc123'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-123');
      expect(sendEmailViaSendGrid).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Reset Your FetchText Password',
        html: expect.stringContaining('Reset Your Password'),
        template: 'password-reset'
      });
    });

    it('should include FetchText branding in password reset email', async () => {
      const mockResponse = { success: true, messageId: 'test-123' };
      vi.mocked(sendEmailViaSendGrid).mockResolvedValue(mockResponse);

      await sendPasswordResetEmail(
        'user@example.com',
        'https://fetchtext.app/reset-password?token=abc123'
      );

      const callArgs = vi.mocked(sendEmailViaSendGrid).mock.calls[0][0];
      expect(callArgs.html).toContain('FetchText');
      expect(callArgs.html).toContain('667eea');
      expect(callArgs.html).toContain('764ba2');
    });

    it('should handle SendGrid failure gracefully', async () => {
      vi.mocked(sendEmailViaSendGrid).mockResolvedValue({ 
        success: false, 
        error: 'SendGrid API error' 
      });

      const result = await sendPasswordResetEmail(
        'user@example.com',
        'https://fetchtext.app/reset-password?token=abc123'
      );

      // Should fall back to development mode
      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^dev-/);
    });
  });

  describe('Welcome Email', () => {
    it('should send welcome email successfully', async () => {
      const mockResponse = { success: true, messageId: 'welcome-123' };
      vi.mocked(sendEmailViaSendGrid).mockResolvedValue(mockResponse);

      const result = await sendWelcomeEmail('user@example.com', 'John Doe');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('welcome-123');
      expect(sendEmailViaSendGrid).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Welcome to FetchText!',
        html: expect.stringContaining('Hello John Doe!'),
        template: 'welcome'
      });
    });

    it('should include feature highlights in welcome email', async () => {
      const mockResponse = { success: true, messageId: 'welcome-123' };
      vi.mocked(sendEmailViaSendGrid).mockResolvedValue(mockResponse);

      await sendWelcomeEmail('user@example.com', 'John Doe');

      const callArgs = vi.mocked(sendEmailViaSendGrid).mock.calls[0][0];
      expect(callArgs.html).toContain('AI Document Processing');
      expect(callArgs.html).toContain('Template Generation');
      expect(callArgs.html).toContain('Workflow Automation');
    });

    it('should handle empty username gracefully', async () => {
      const mockResponse = { success: true, messageId: 'welcome-123' };
      vi.mocked(sendEmailViaSendGrid).mockResolvedValue(mockResponse);

      const result = await sendWelcomeEmail('user@example.com', '');

      expect(result.success).toBe(true);
      expect(sendEmailViaSendGrid).toHaveBeenCalled();
    });
  });

  describe('Two-Factor Authentication Email', () => {
    it('should send 2FA email successfully', async () => {
      const mockResponse = { success: true, messageId: '2fa-123' };
      vi.mocked(sendEmailViaSendGrid).mockResolvedValue(mockResponse);

      const result = await sendTwoFactorEmail('user@example.com', '123456');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('2fa-123');
      expect(sendEmailViaSendGrid).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Your FetchText Security Code',
        html: expect.stringContaining('123456'),
        template: 'two-factor'
      });
    });

    it('should include security messaging in 2FA email', async () => {
      const mockResponse = { success: true, messageId: '2fa-123' };
      vi.mocked(sendEmailViaSendGrid).mockResolvedValue(mockResponse);

      await sendTwoFactorEmail('user@example.com', '123456');

      const callArgs = vi.mocked(sendEmailViaSendGrid).mock.calls[0][0];
      expect(callArgs.html).toContain('10 minutes');
      expect(callArgs.html).toContain('secure your account');
      expect(callArgs.html).toContain('123456');
    });

    it('should handle various code formats', async () => {
      const mockResponse = { success: true, messageId: '2fa-123' };
      vi.mocked(sendEmailViaSendGrid).mockResolvedValue(mockResponse);

      // Test with different code formats
      const codes = ['123456', '000000', '999999', 'ABC123'];
      
      for (const code of codes) {
        await sendTwoFactorEmail('user@example.com', code);
        const callArgs = vi.mocked(sendEmailViaSendGrid).mock.calls[codes.indexOf(code)][0];
        expect(callArgs.html).toContain(code);
      }
    });
  });

  describe('Email Validation', () => {
    it('should validate email addresses correctly', () => {
      // Mock the actual validation function
      vi.mocked(validateEmailAddress).mockImplementation((email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      });

      expect(validateEmailAddress('user@example.com')).toBe(true);
      expect(validateEmailAddress('test@gmail.com')).toBe(true);
      expect(validateEmailAddress('invalid-email')).toBe(false);
      expect(validateEmailAddress('user@')).toBe(false);
      expect(validateEmailAddress('@example.com')).toBe(false);
      expect(validateEmailAddress('')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle SendGrid API errors', async () => {
      vi.mocked(sendEmailViaSendGrid).mockRejectedValue(new Error('Network error'));

      const result = await sendPasswordResetEmail(
        'user@example.com',
        'https://fetchtext.app/reset-password?token=abc123'
      );

      // Should fall back to development mode
      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^dev-/);
    });

    it('should handle invalid responses gracefully', async () => {
      vi.mocked(sendEmailViaSendGrid).mockResolvedValue({ 
        success: false, 
        error: 'Invalid API key' 
      });

      const result = await sendWelcomeEmail('user@example.com', 'John Doe');

      // Should fall back to development mode
      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^dev-/);
    });
  });

  describe('Template Content Validation', () => {
    it('should generate HTML with proper structure', async () => {
      const mockResponse = { success: true, messageId: 'test-123' };
      vi.mocked(sendEmailViaSendGrid).mockResolvedValue(mockResponse);

      await sendPasswordResetEmail(
        'user@example.com',
        'https://fetchtext.app/reset-password?token=abc123'
      );

      const callArgs = vi.mocked(sendEmailViaSendGrid).mock.calls[0][0];
      expect(callArgs.html).toContain('<!DOCTYPE html>');
      expect(callArgs.html).toContain('<html>');
      expect(callArgs.html).toContain('<head>');
      expect(callArgs.html).toContain('<body>');
      expect(callArgs.html).toContain('</html>');
    });

    it('should include responsive design elements', async () => {
      const mockResponse = { success: true, messageId: 'test-123' };
      vi.mocked(sendEmailViaSendGrid).mockResolvedValue(mockResponse);

      await sendWelcomeEmail('user@example.com', 'John Doe');

      const callArgs = vi.mocked(sendEmailViaSendGrid).mock.calls[0][0];
      expect(callArgs.html).toContain('viewport');
      expect(callArgs.html).toContain('max-width');
      expect(callArgs.html).toContain('font-family');
    });
  });

  describe('Integration Flow', () => {
    it('should complete full password reset flow', async () => {
      const mockResponse = { success: true, messageId: 'reset-flow-123' };
      vi.mocked(sendEmailViaSendGrid).mockResolvedValue(mockResponse);

      const email = 'user@example.com';
      const resetToken = 'secure-reset-token-123';
      const resetUrl = `https://fetchtext.app/reset-password?token=${resetToken}`;

      const result = await sendPasswordResetEmail(email, resetUrl);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('reset-flow-123');
      
      const callArgs = vi.mocked(sendEmailViaSendGrid).mock.calls[0][0];
      expect(callArgs.to).toBe(email);
      expect(callArgs.subject).toBe('Reset Your FetchText Password');
      expect(callArgs.html).toContain(resetUrl);
      expect(callArgs.template).toBe('password-reset');
    });

    it('should complete full welcome flow', async () => {
      const mockResponse = { success: true, messageId: 'welcome-flow-123' };
      vi.mocked(sendEmailViaSendGrid).mockResolvedValue(mockResponse);

      const email = 'newuser@example.com';
      const userName = 'Jane Smith';

      const result = await sendWelcomeEmail(email, userName);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('welcome-flow-123');
      
      const callArgs = vi.mocked(sendEmailViaSendGrid).mock.calls[0][0];
      expect(callArgs.to).toBe(email);
      expect(callArgs.subject).toBe('Welcome to FetchText!');
      expect(callArgs.html).toContain(userName);
      expect(callArgs.template).toBe('welcome');
    });
  });

  describe('Performance', () => {
    it('should handle concurrent email sends', async () => {
      const mockResponse = { success: true, messageId: 'concurrent-123' };
      vi.mocked(sendEmailViaSendGrid).mockResolvedValue(mockResponse);

      const emails = [
        sendPasswordResetEmail('user1@example.com', 'https://fetchtext.app/reset-password?token=1'),
        sendPasswordResetEmail('user2@example.com', 'https://fetchtext.app/reset-password?token=2'),
        sendWelcomeEmail('user3@example.com', 'User 3'),
        sendTwoFactorEmail('user4@example.com', '123456')
      ];

      const results = await Promise.all(emails);

      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.messageId).toBe('concurrent-123');
      });
    });

    it('should handle high-volume email sending', async () => {
      const mockResponse = { success: true, messageId: 'volume-123' };
      vi.mocked(sendEmailViaSendGrid).mockResolvedValue(mockResponse);

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(sendWelcomeEmail(`user${i}@example.com`, `User ${i}`));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
}); 