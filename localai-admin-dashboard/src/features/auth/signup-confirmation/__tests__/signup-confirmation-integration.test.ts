import { describe, it, expect, beforeEach } from 'vitest'
import {
  sendWelcomeEmail,
  validateEmail,
  sanitizeEmail,
} from '@/lib/email-client'

// Integration tests for signup confirmation email flow with real SendGrid API calls
// These tests make actual API requests to SendGrid
// Set VITE_RUN_INTEGRATION_TESTS=true to enable these tests
const shouldRunIntegrationTests =
  import.meta.env.VITE_RUN_INTEGRATION_TESTS === 'true'

describe.skipIf(!shouldRunIntegrationTests)(
  'Signup Confirmation Email Integration (Real API)',
  () => {
    // Use test emails that won't go to real users
    const TEST_EMAIL = 'fetchtext.signup.test@example.com'
    const TEST_USER_NAME = 'New Test User'
    const INVALID_EMAIL = 'invalid-email-format'

    describe('Welcome Email Integration', () => {
      it('should return proper response structure for welcome email', async () => {
        const result = await sendWelcomeEmail(TEST_EMAIL, TEST_USER_NAME)

        // Check result structure exists
        expect(result).toHaveProperty('success')
        expect(typeof result.success).toBe('boolean')

        if (result.success) {
          // If successful, should have messageId
          expect(result).toHaveProperty('messageId')
          expect(typeof result.messageId).toBe('string')
          expect(result.messageId).toBeTruthy()
          expect(result.error).toBeUndefined()
        } else {
          // If failed, should have error message
          expect(result).toHaveProperty('error')
          expect(typeof result.error).toBe('string')
          expect(result.error).toBeTruthy()
          expect(result.messageId).toBeUndefined()
        }
      })

      it('should handle different user name formats', async () => {
        const testCases = [
          { email: 'test1@example.com', name: 'John Doe' },
          { email: 'test2@example.com', name: 'Jane' },
          { email: 'test3@example.com', name: 'User With Long Name' },
          { email: 'test4@example.com', name: '' }, // Empty name
        ]

        const results = await Promise.all(
          testCases.map(({ email, name }) => sendWelcomeEmail(email, name))
        )

        // All should have proper structure regardless of name format
        results.forEach((result) => {
          expect(result).toHaveProperty('success')
          expect(typeof result.success).toBe('boolean')

          if (!result.success) {
            expect(result.error).toBeTruthy()
          }
        })
      })

      it('should handle invalid email addresses gracefully', async () => {
        const result = await sendWelcomeEmail(INVALID_EMAIL, TEST_USER_NAME)

        // Should fail with invalid email
        expect(result.success).toBe(false)
        expect(result.error).toBeTruthy()
        expect(typeof result.error).toBe('string')
      })

      it('should handle empty email address', async () => {
        const result = await sendWelcomeEmail('', TEST_USER_NAME)

        // Should fail with empty email
        expect(result.success).toBe(false)
        expect(result.error).toBeTruthy()
        expect(typeof result.error).toBe('string')
      })

      it('should handle special characters in user names', async () => {
        const specialNames = [
          'José María',
          'Müller',
          "O'Connor",
          'User-Name_123',
          'User@Company',
        ]

        const results = await Promise.all(
          specialNames.map((name) =>
            sendWelcomeEmail(`test.${Date.now()}@example.com`, name)
          )
        )

        // All should have proper structure
        results.forEach((result) => {
          expect(result).toHaveProperty('success')
          expect(typeof result.success).toBe('boolean')
        })
      })
    })

    describe('Email Validation for Signup', () => {
      it('should validate common email formats', () => {
        const validEmails = [
          'user@example.com',
          'test.email@domain.co.uk',
          'user+tag@subdomain.example.org',
          'firstname.lastname@company.com',
          'email@123.123.123.123', // IP address domains are valid
          'user_name@example-domain.com',
        ]

        validEmails.forEach((email) => {
          expect(validateEmail(email)).toBe(true)
        })
      })

      it('should reject invalid email formats', () => {
        const invalidEmails = [
          'not-an-email',
          '@domain.com',
          'user@',
          'user..double.dot@example.com',
          'user @example.com', // space
          'user@.com',
          'user@com',
          '',
          'user@example', // no TLD
          'user@example..com', // double dot in domain
        ]

        invalidEmails.forEach((email) => {
          expect(validateEmail(email)).toBe(false)
        })
      })

      it('should sanitize email inputs properly', () => {
        const testCases = [
          { input: '  USER@EXAMPLE.COM  ', expected: 'user@example.com' },
          {
            input: 'Test<Script>@Domain.Com',
            expected: 'testscript@domain.com',
          },
          {
            input: 'User>Alert@Example.Org',
            expected: 'useralert@example.org',
          },
          {
            input: 'NORMAL.EMAIL@DOMAIN.COM',
            expected: 'normal.email@domain.com',
          },
          { input: '\t\nuser@example.com\r\n', expected: 'user@example.com' },
        ]

        testCases.forEach(({ input, expected }) => {
          expect(sanitizeEmail(input)).toBe(expected)
        })
      })
    })

    describe('Signup Confirmation Flow Integration', () => {
      it('should handle rapid signup confirmations', async () => {
        // Simulate multiple users signing up quickly
        const users = Array(3)
          .fill(0)
          .map((_, i) => ({
            email: `rapid.signup.${i}.${Date.now()}@example.com`,
            name: `User ${i}`,
          }))

        const results = await Promise.all(
          users.map((user) => sendWelcomeEmail(user.email, user.name))
        )

        // All should either succeed or fail gracefully
        results.forEach((result) => {
          expect(result).toHaveProperty('success')
          if (!result.success) {
            expect(result.error).toBeTruthy()
          }
        })
      })

      it('should validate email configuration for signup flow', async () => {
        // Basic validation that our email validation works
        expect(validateEmail('test@example.com')).toBe(true)
        expect(validateEmail('invalid-email')).toBe(false)

        // Verify function exists and works
        expect(typeof validateEmail).toBe('function')
        expect(typeof sanitizeEmail).toBe('function')
      })

      it('should handle concurrent welcome email sends', async () => {
        const concurrentCount = 5
        const promises = Array(concurrentCount)
          .fill(0)
          .map((_, i) =>
            sendWelcomeEmail(
              `concurrent.${i}.${Date.now()}@example.com`,
              `User ${i}`
            )
          )

        const results = await Promise.allSettled(promises)

        // All promises should settle (not reject)
        results.forEach((result) => {
          expect(result.status).toBe('fulfilled')
          if (result.status === 'fulfilled') {
            expect(result.value).toHaveProperty('success')
            expect(typeof result.value.success).toBe('boolean')
          }
        })
      })
    })

    describe('Error Handling in Signup Flow', () => {
      it('should handle malformed email data gracefully', async () => {
        const malformedInputs = [
          { email: null as unknown as string, name: 'Test User' },
          { email: undefined as unknown as string, name: 'Test User' },
          { email: 'test@example.com', name: null as unknown as string },
          { email: 'test@example.com', name: undefined as unknown as string },
        ]

        for (const input of malformedInputs) {
          const result = await sendWelcomeEmail(input.email, input.name)

          expect(result).toHaveProperty('success')
          expect(typeof result.success).toBe('boolean')

          if (!result.success) {
            expect(result.error).toBeTruthy()
          }
        }
      })

      it('should handle extremely long user names', async () => {
        const longName = 'A'.repeat(1000) // Very long name
        const result = await sendWelcomeEmail(TEST_EMAIL, longName)

        expect(result).toHaveProperty('success')
        expect(typeof result.success).toBe('boolean')
      })

      it('should handle international characters in emails', async () => {
        // Note: These might not be valid depending on email service configuration
        const internationalEmails = [
          'user@münchen.de',
          'user@测试.com',
          'tëst@example.com',
        ]

        const results = await Promise.all(
          internationalEmails.map((email) =>
            sendWelcomeEmail(email, 'Test User')
          )
        )

        // All should have proper structure (may succeed or fail depending on config)
        results.forEach((result) => {
          expect(result).toHaveProperty('success')
          expect(typeof result.success).toBe('boolean')
        })
      })
    })

    describe('Performance and Rate Limiting', () => {
      beforeEach(() => {
        // Add small delay to avoid hitting rate limits too hard
        return new Promise((resolve) => setTimeout(resolve, 100))
      })

      it('should handle email sending within reasonable time', async () => {
        const startTime = Date.now()
        const result = await sendWelcomeEmail(TEST_EMAIL, TEST_USER_NAME)
        const endTime = Date.now()

        const duration = endTime - startTime

        // Should complete within 30 seconds (generous for network requests)
        expect(duration).toBeLessThan(30000)

        // Check result structure
        expect(result).toHaveProperty('success')
        expect(typeof result.success).toBe('boolean')
      })

      it('should handle batch welcome emails efficiently', async () => {
        const batchSize = 3
        const startTime = Date.now()

        const promises = Array(batchSize)
          .fill(0)
          .map((_, i) =>
            sendWelcomeEmail(
              `batch.${i}.${Date.now()}@example.com`,
              `Batch User ${i}`
            )
          )

        const results = await Promise.all(promises)
        const endTime = Date.now()

        const duration = endTime - startTime
        const averageTime = duration / batchSize

        // Average time per email should be reasonable
        expect(averageTime).toBeLessThan(10000) // 10 seconds per email max

        // All should have proper structure
        results.forEach((result) => {
          expect(result).toHaveProperty('success')
          expect(typeof result.success).toBe('boolean')
        })
      })
    })
  }
)
