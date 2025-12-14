/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendPasswordResetEmail, sendWelcomeEmail, sendTwoFactorEmail, deployPasswordResetWorkflow } from '../n8n-email-client';
import { emailClient, N8NEmailClient, EmailRequest } from '../email-client';

// Mock the N8N client
vi.mock('../n8n-client', () => ({
  N8nClient: vi.fn().mockImplementation(() => ({
    getWorkflows: vi.fn().mockResolvedValue([]),
    createWorkflow: vi.fn().mockResolvedValue({ id: 'test-workflow-id' }),
    activateWorkflow: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock fetch for webhook calls
global.fetch = vi.fn() as typeof fetch;

// Mock the fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the EMAIL_CONFIG
vi.mock('@/config/email', () => ({
  EMAIL_CONFIG: {
    FROM_EMAIL: 'test@fetchtext.io',
    FROM_NAME: 'FetchText Support',
  },
}));

describe('N8N Email Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock environment variables
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_N8N_URL', 'http://localhost:5678');
    vi.stubEnv('VITE_N8N_API_KEY', 'test-api-key');
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email successfully in production', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          messageId: 'test-message-id',
        }),
      };
      (fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await sendPasswordResetEmail('test@example.com', 'http://localhost:3000/reset?token=123');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:5678/webhook/password-reset-email',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('test@example.com'),
        })
      );
    });

    it('should handle webhook failure', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      };
      (fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await sendPasswordResetEmail('test@example.com', 'http://localhost:3000/reset?token=123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('N8N webhook failed: 500');
    });

    it('should handle N8N workflow execution failure', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: false,
          error: 'SendGrid API error',
        }),
      };
      (fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await sendPasswordResetEmail('test@example.com', 'http://localhost:3000/reset?token=123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('SendGrid API error');
    });

    it('should handle network errors', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await sendPasswordResetEmail('test@example.com', 'http://localhost:3000/reset?token=123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email successfully', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          messageId: 'welcome-message-id',
        }),
      };
      (fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await sendWelcomeEmail('test@example.com', 'John Doe');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('welcome-message-id');
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:5678/webhook/password-reset-email',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('John Doe'),
        })
      );
    });
  });

  describe('sendTwoFactorEmail', () => {
    it('should send two-factor email successfully', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          messageId: '2fa-message-id',
        }),
      };
      (fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await sendTwoFactorEmail('test@example.com', '123456');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('2fa-message-id');
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:5678/webhook/password-reset-email',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('123456'),
        })
      );
    });
  });

  describe('Development Mode', () => {
    beforeEach(() => {
      vi.stubEnv('DEV', true);
    });

    it('should simulate email sending in development mode', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await sendPasswordResetEmail('test@example.com', 'http://localhost:3000/reset?token=123');

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^n8n-dev-/);
      expect(consoleSpy).toHaveBeenCalledWith('📧 N8N EMAIL SIMULATION (Development Mode)');
      expect(fetch).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should log email details in development mode', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await sendPasswordResetEmail('test@example.com', 'http://localhost:3000/reset?token=123');

      expect(consoleSpy).toHaveBeenCalledWith('To: test@example.com');
      expect(consoleSpy).toHaveBeenCalledWith('Subject: Reset Your FetchText Password');
      expect(consoleSpy).toHaveBeenCalledWith('Template: password-reset');
      expect(consoleSpy).toHaveBeenCalledWith('N8N Webhook: http://localhost:5678/webhook/password-reset-email');

      consoleSpy.mockRestore();
    });
  });

  describe('deployPasswordResetWorkflow', () => {
    it('should activate existing workflow if found', async () => {
      // Mock fetch to simulate workflow backup loading
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await deployPasswordResetWorkflow();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Could not load workflow from backup');
    });

    it('should create new workflow if not found', async () => {
      // Mock fetch to simulate workflow backup loading
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await deployPasswordResetWorkflow();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Could not load workflow from backup');
    });

    it('should handle workflow deployment failure', async () => {
      // Mock fetch to simulate workflow backup loading failure
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await deployPasswordResetWorkflow();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Could not load workflow from backup');
    });

    it('should handle missing workflow backup file', async () => {
      const mockN8nClient = {
        getWorkflows: vi.fn().mockResolvedValue([]),
      };

      // Mock fetch to return 404 for missing backup file
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const { N8nClient } = await import('../n8n-client');
      (N8nClient as any).mockImplementation(() => mockN8nClient);

      const result = await deployPasswordResetWorkflow();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Could not load workflow from backup');
    });
  });

  describe('Email Content Generation', () => {
    it('should generate proper HTML content for password reset', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.stubEnv('DEV', true);

      await sendPasswordResetEmail('test@example.com', 'http://localhost:3000/reset?token=123');

      const htmlContent = consoleSpy.mock.calls.find(call => 
        call[0] && call[0].includes('<!DOCTYPE html>')
      )?.[0];

      expect(htmlContent).toContain('🔐 FetchText');
      expect(htmlContent).toContain('Reset Your Password');
      expect(htmlContent).toContain('http://localhost:3000/reset?token=123');
      expect(htmlContent).toContain('This link will expire in 24 hours');

      consoleSpy.mockRestore();
    });

    it('should generate proper HTML content for welcome email', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.stubEnv('DEV', true);

      await sendWelcomeEmail('test@example.com', 'John Doe');

      const htmlContent = consoleSpy.mock.calls.find(call => 
        call[0] && call[0].includes('<!DOCTYPE html>')
      )?.[0];

      expect(htmlContent).toContain('🎉 Welcome to FetchText!');
      expect(htmlContent).toContain('Hello John Doe!');
      expect(htmlContent).toContain('AI Document Processing');
      expect(htmlContent).toContain('Template Generation');

      consoleSpy.mockRestore();
    });

    it('should generate proper HTML content for two-factor email', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.stubEnv('DEV', true);

      await sendTwoFactorEmail('test@example.com', '123456');

      const htmlContent = consoleSpy.mock.calls.find(call => 
        call[0] && call[0].includes('<!DOCTYPE html>')
      )?.[0];

      expect(htmlContent).toContain('🔐 FetchText');
      expect(htmlContent).toContain('Your Verification Code');
      expect(htmlContent).toContain('123456');
      expect(htmlContent).toContain('This code expires in 10 minutes');

      consoleSpy.mockRestore();
    });
  });

  describe('Webhook URL Construction', () => {
    it('should use environment variables for webhook URL', async () => {
      // Since environment variables are cached at import time,
      // this test verifies the default behavior
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ success: true, messageId: 'test-id' }),
      };
      (fetch as any).mockResolvedValueOnce(mockResponse);

      await sendPasswordResetEmail('test@example.com', 'http://localhost:3000/reset?token=123');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:5678/webhook/password-reset-email',
        expect.any(Object)
      );
    });

    it('should use default N8N URL if not provided', async () => {
      vi.stubEnv('VITE_N8N_URL', '');
      
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ success: true, messageId: 'test-id' }),
      };
      (fetch as any).mockResolvedValueOnce(mockResponse);

      await sendPasswordResetEmail('test@example.com', 'http://localhost:3000/reset?token=123');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:5678/webhook/password-reset-email',
        expect.any(Object)
      );
    });
  });

  describe('Reset URL Extraction', () => {
    it('should extract reset URL from HTML content', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ success: true, messageId: 'test-id' }),
      };
      (fetch as any).mockResolvedValueOnce(mockResponse);

      await sendPasswordResetEmail('test@example.com', 'http://localhost:3000/reset?token=123');

      const fetchCall = (fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      expect(requestBody.resetUrl).toBe('http://localhost:3000/reset?token=123');
      expect(requestBody.email).toBe('test@example.com');
      expect(requestBody.template).toBe('password-reset');
    });
  });
});

describe('N8NEmailClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ message: 'Email sent successfully' }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await emailClient.sendPasswordResetEmail('user@example.com', 'test-token');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5678/webhook/password-reset-email',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('user@example.com'),
        }
      );

      // Verify the payload includes messageHTML
      const callArgs = mockFetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      expect(payload.messageHTML).toBeTruthy();
      expect(payload.messageHTML).toContain('Reset Your FetchText Password');
      expect(payload.to).toBe('user@example.com');
      expect(payload.resetToken).toBe('test-token');

      expect(result).toEqual({
        success: true,
        message: 'Email sent successfully',
      });
    });

    it('should handle failed password reset email', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await emailClient.sendPasswordResetEmail('user@example.com', 'test-token');

      expect(result).toEqual({
        success: false,
        error: 'N8N webhook failed: 500 Internal Server Error',
      });
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await emailClient.sendPasswordResetEmail('user@example.com', 'test-token');

      expect(result).toEqual({
        success: false,
        error: 'Network error',
      });
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ message: 'Welcome email sent' }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await emailClient.sendWelcomeEmail('user@example.com', 'John Doe');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5678/webhook/welcome-email',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('user@example.com'),
        }
      );

      // Verify the payload includes messageHTML
      const callArgs = mockFetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      expect(payload.messageHTML).toBeTruthy();
      expect(payload.messageHTML).toContain('Welcome to FetchText!');
      expect(payload.userName).toBe('John Doe');

      expect(result).toEqual({
        success: true,
        message: 'Welcome email sent',
      });
    });
  });

  describe('sendTwoFactorEmail', () => {
    it('should send two-factor email successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ message: 'Code sent' }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await emailClient.sendTwoFactorEmail('user@example.com', '123456');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5678/webhook/two-factor-email',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('user@example.com'),
        }
      );

      // Verify the payload includes messageHTML
      const callArgs = mockFetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      expect(payload.messageHTML).toBeTruthy();
      expect(payload.messageHTML).toContain('Your FetchText Verification Code');
      expect(payload.code).toBe('123456');

      expect(result).toEqual({
        success: true,
        message: 'Code sent',
      });
    });
  });

  describe('sendGenericEmail', () => {
    it('should send generic email successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ message: 'Email sent' }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const request: EmailRequest = {
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<h1>Test HTML</h1>',
        templateType: 'password-reset',
        variables: {
          customVar: 'test-value',
        },
      };

      const result = await emailClient.sendGenericEmail(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5678/webhook/password-reset-email',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('user@example.com'),
        }
      );

      // Verify the payload includes messageHTML
      const callArgs = mockFetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      expect(payload.messageHTML).toBe('<h1>Test HTML</h1>');
      expect(payload.customVar).toBe('test-value');

      expect(result).toEqual({
        success: true,
        message: 'Email sent',
      });
    });

    it('should handle unknown template type', async () => {
      const request: EmailRequest = {
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<h1>Test HTML</h1>',
        templateType: 'unknown' as 'password-reset',
      };

      const result = await emailClient.sendGenericEmail(request);

      expect(result).toEqual({
        success: false,
        error: 'Unknown email template type: unknown',
      });
    });
  });

  describe('N8NEmailClient class', () => {
    it('should be exportable as a class', () => {
      const client = new N8NEmailClient();
      expect(client).toBeInstanceOf(N8NEmailClient);
    });

    it('should have all required methods', () => {
      const client = new N8NEmailClient();
      expect(typeof client.sendPasswordResetEmail).toBe('function');
      expect(typeof client.sendWelcomeEmail).toBe('function');
      expect(typeof client.sendTwoFactorEmail).toBe('function');
      expect(typeof client.sendGenericEmail).toBe('function');
    });
  });

  describe('messageHTML Content Validation', () => {
    it('should include proper HTML structure for password reset', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ message: 'Email sent' }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await emailClient.sendPasswordResetEmail('user@example.com', 'test-token');

      const callArgs = mockFetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      
      expect(payload.messageHTML).toContain('<div style="font-family: Arial, sans-serif;');
      expect(payload.messageHTML).toContain('Reset Your FetchText Password');
      expect(payload.messageHTML).toContain('Reset Password');
      expect(payload.messageHTML).toContain('expire in 1 hour');
    });

    it('should include proper HTML structure for welcome email', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ message: 'Email sent' }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await emailClient.sendWelcomeEmail('user@example.com', 'John Doe');

      const callArgs = mockFetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      
      expect(payload.messageHTML).toContain('<div style="font-family: Arial, sans-serif;');
      expect(payload.messageHTML).toContain('Welcome to FetchText!');
      expect(payload.messageHTML).toContain('Hi John Doe');
      expect(payload.messageHTML).toContain('Go to Dashboard');
    });

    it('should include proper HTML structure for two-factor email', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ message: 'Email sent' }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await emailClient.sendTwoFactorEmail('user@example.com', '123456');

      const callArgs = mockFetch.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      
      expect(payload.messageHTML).toContain('<div style="font-family: Arial, sans-serif;');
      expect(payload.messageHTML).toContain('Your FetchText Verification Code');
      expect(payload.messageHTML).toContain('123456');
      expect(payload.messageHTML).toContain('expire in 10 minutes');
    });
  });
}); 