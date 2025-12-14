import { describe, it, expect } from 'vitest';
import { 
  sendPasswordResetEmail, 
  sendWelcomeEmail,
  sendTwoFactorEmail
} from '../email-client';
import { validateEmail, sanitizeEmail } from '../email-service';

// Integration tests for email service with real SendGrid API calls
// These tests make actual API requests to SendGrid
// Set VITE_RUN_INTEGRATION_TESTS=true to enable these tests
const shouldRunIntegrationTests = import.meta.env.VITE_RUN_INTEGRATION_TESTS === 'true';

describe.skipIf(!shouldRunIntegrationTests)('Email Service Integration (Real API)', () => {
  // Use a test email that won't go to real users
  const TEST_EMAIL = 'fetchtext.test@example.com';
  const TEST_TOKEN = 'test-reset-token-123';
  const TEST_USER_NAME = 'Test User';
  const TEST_2FA_CODE = '123456';

  describe('Real SendGrid API Integration', () => {
    it('should return proper response structure for password reset email', async () => {
      const result = await sendPasswordResetEmail(TEST_EMAIL, TEST_TOKEN);
      
      // Check result structure exists
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      
      if (result.success) {
        // If successful, should have messageId
        expect(result).toHaveProperty('messageId');
        expect(typeof result.messageId).toBe('string');
        expect(result.messageId).toBeTruthy();
        expect(result.error).toBeUndefined();
      } else {
        // If failed, should have error message
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
        expect(result.error).toBeTruthy();
        expect(result.messageId).toBeUndefined();
      }
    });

    it('should return proper response structure for welcome email', async () => {
      const result = await sendWelcomeEmail(TEST_EMAIL, TEST_USER_NAME);
      
      // Check result structure exists
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      
      if (result.success) {
        // If successful, should have messageId
        expect(result).toHaveProperty('messageId');
        expect(typeof result.messageId).toBe('string');
        expect(result.messageId).toBeTruthy();
        expect(result.error).toBeUndefined();
      } else {
        // If failed, should have error message
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
        expect(result.error).toBeTruthy();
        expect(result.messageId).toBeUndefined();
      }
    });

    it('should return proper response structure for two-factor email', async () => {
      const result = await sendTwoFactorEmail(TEST_EMAIL, TEST_2FA_CODE);
      
      // Check result structure exists
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      
      if (result.success) {
        // If successful, should have messageId
        expect(result).toHaveProperty('messageId');
        expect(typeof result.messageId).toBe('string');
        expect(result.messageId).toBeTruthy();
        expect(result.error).toBeUndefined();
      } else {
        // If failed, should have error message
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
        expect(result.error).toBeTruthy();
        expect(result.messageId).toBeUndefined();
      }
    });

    it('should handle invalid email addresses', async () => {
      const invalidEmail = 'not-an-email';
      const result = await sendPasswordResetEmail(invalidEmail, TEST_TOKEN);
      
      // Should fail with invalid email
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(typeof result.error).toBe('string');
    });

    it('should handle rate limiting gracefully', async () => {
      // Send multiple emails quickly to test rate limiting
      const promises = Array(3).fill(0).map((_, i) => 
        sendPasswordResetEmail(`test${i}@example.com`, `token${i}`)
      );
      
      const results = await Promise.all(promises);
      
      // All should either succeed or fail gracefully
      results.forEach((result) => {
        expect(result).toHaveProperty('success');
        if (!result.success) {
          expect(result.error).toBeTruthy();
        }
      });
    });
  });

  describe('Email Utility Functions', () => {
    it('should validate email addresses correctly', () => {
      // Valid emails
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test+label@domain.co.uk')).toBe(true);
      expect(validateEmail('name.surname@company.io')).toBe(true);
      
      // Invalid emails
      expect(validateEmail('not-an-email')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('user space@domain.com')).toBe(false);
    });

    it('should sanitize email inputs', () => {
      expect(sanitizeEmail('  USER@EXAMPLE.COM  ')).toBe('user@example.com');
      expect(sanitizeEmail('test<script>@domain.com')).toBe('testscript@domain.com');
      expect(sanitizeEmail('user>alert@domain.com')).toBe('useralert@domain.com');
      expect(sanitizeEmail('NORMAL@DOMAIN.COM')).toBe('normal@domain.com');
    });
  });

  describe('Email Configuration Validation', () => {
    it('should have proper email configuration', async () => {
      const { EMAIL_CONFIG } = await import('@/config/email');
      
      // Check required config exists
      expect(EMAIL_CONFIG.FROM_EMAIL).toBeTruthy();
      expect(EMAIL_CONFIG.FROM_NAME).toBeTruthy();
      expect(EMAIL_CONFIG.APP_URL).toBeTruthy();
      
      // Validate FROM_EMAIL format
      expect(validateEmail(EMAIL_CONFIG.FROM_EMAIL)).toBe(true);
      
      // Check template IDs exist
      expect(EMAIL_CONFIG.TEMPLATES.PASSWORD_RESET).toBeTruthy();
      expect(EMAIL_CONFIG.TEMPLATES.WELCOME).toBeTruthy();
      expect(EMAIL_CONFIG.TEMPLATES.TWO_FACTOR).toBeTruthy();
      
      // Email configuration validated successfully
    });
  });

  describe('Error Handling with Real API', () => {
    it('should handle SendGrid API errors gracefully', async () => {
      // Test with malformed template data to trigger an error
      const result = await sendPasswordResetEmail('', ''); // Empty email should cause error
      
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(typeof result.error).toBe('string');
    });
  });
}); 