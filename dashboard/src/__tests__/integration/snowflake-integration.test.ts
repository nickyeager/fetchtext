/**
 * Snowflake Integration Tests
 *
 * Frontend-to-backend flow tests for the Snowflake Stages integration.
 * Requires the document-processor backend to be running.
 *
 * Run with:
 *   cd dashboard
 *   source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run src/__tests__/integration/snowflake-integration.test.ts
 */

const BACKEND_URL =
  process.env.VITE_DOCUMENT_PROCESSOR_URL || 'http://localhost:8090'

describe('Snowflake Integration', () => {
  // Pre-check: backend must be running
  beforeAll(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/health`)
      if (!response.ok) {
        throw new Error(`Backend unhealthy: ${response.status}`)
      }
    } catch (error) {
      throw new Error(
        `Backend not available at ${BACKEND_URL}. ` +
          'Start with: docker compose -p localai up -d --build document-processor. ' +
          `Error: ${error}`
      )
    }
  })

  describe('Integration Registry', () => {
    it('should include snowflake in the integrations list with dual auth mode', async () => {
      const response = await fetch(`${BACKEND_URL}/api/integrations/`)
      expect(response.ok).toBe(true)

      const integrations = await response.json()
      const snowflake = integrations.find(
        (i: { id: string }) => i.id === 'snowflake'
      )
      expect(snowflake).toBeDefined()
      expect(snowflake.auth_mode).toBe('dual')
      expect(snowflake.configured).toBe(true)
      expect(snowflake.credential_fields).toBeDefined()
      expect(snowflake.credential_fields.length).toBeGreaterThanOrEqual(4)
      // Dual mode should expose both auth methods
      expect(snowflake.auth_modes).toEqual(['credential', 'oauth'])
    })

    it('should return snowflake detail with credential_fields and auth_modes', async () => {
      const response = await fetch(
        `${BACKEND_URL}/api/integrations/snowflake`
      )
      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.auth_mode).toBe('dual')
      expect(data.credential_fields).toBeDefined()
      expect(data.auth_modes).toEqual(['credential', 'oauth'])

      const fieldNames = data.credential_fields.map(
        (f: { name: string }) => f.name
      )
      expect(fieldNames).toContain('account_identifier')
      expect(fieldNames).toContain('username')
      expect(fieldNames).toContain('private_key')
      expect(fieldNames).toContain('warehouse')
    })

    it('should not break existing OAuth integrations', async () => {
      const response = await fetch(`${BACKEND_URL}/api/integrations/`)
      expect(response.ok).toBe(true)

      const integrations = await response.json()
      const google = integrations.find(
        (i: { id: string }) => i.id === 'google'
      )
      expect(google).toBeDefined()
      expect(google.auth_mode).toBe('oauth')
      // Pure OAuth integrations should NOT have auth_modes
      expect(google.auth_modes).toBeFalsy()
    })
  })

  describe('Credential Validation', () => {
    it('should reject connect-credentials with missing required fields', async () => {
      const response = await fetch(
        `${BACKEND_URL}/api/integrations/snowflake/connect-credentials`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: 'test-org',
            credentials: {
              account_identifier: 'test',
              // Missing username, private_key, warehouse
            },
          }),
        }
      )
      expect(response.status).toBe(422)
    })

    it('should reject connect-credentials for OAuth integrations', async () => {
      const response = await fetch(
        `${BACKEND_URL}/api/integrations/google/connect-credentials`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: 'test-org',
            credentials: { key: 'value' },
          }),
        }
      )
      expect(response.status).toBe(400)
    })
  })

  describe('Per-Account OAuth Initiation', () => {
    // Use a valid UUID format for organization_id (DB requires UUID)
    const testOAuthOrgId = '00000000-0000-0000-0000-000000000099'

    it('should return 400 for non-existent organization', async () => {
      // The endpoint validates org exists in DB before generating auth URL
      const response = await fetch(
        `${BACKEND_URL}/api/integrations/snowflake/oauth/initiate-with-account`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: testOAuthOrgId,
            account_identifier: 'testaccount-fe123',
            client_id: 'test-client-id-fe',
            client_secret: 'test-client-secret-fe',
            redirect_uri: `${BACKEND_URL}/api/integrations/snowflake/oauth/callback`,
          }),
        }
      )
      // Should return 400 because the test org UUID doesn't exist in DB
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.detail).toContain('not found')
    })

    it('should reject per-account OAuth for pure OAuth integrations', async () => {
      const response = await fetch(
        `${BACKEND_URL}/api/integrations/google/oauth/initiate-with-account`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: 'test-org',
            account_identifier: 'test',
            client_id: 'test',
            client_secret: 'test',
            redirect_uri: 'http://localhost:8090/callback',
          }),
        }
      )
      expect(response.status).toBe(400)
    })

    it('should return 404 for non-existent integration', async () => {
      const response = await fetch(
        `${BACKEND_URL}/api/integrations/nonexistent/oauth/initiate-with-account`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: 'test-org',
            account_identifier: 'test',
            client_id: 'test',
            client_secret: 'test',
            redirect_uri: 'http://localhost:8090/callback',
          }),
        }
      )
      expect(response.status).toBe(404)
    })
  })

  describe('Snowflake Endpoints Registration', () => {
    it('should have all snowflake endpoints registered (not 404)', async () => {
      const endpoints = [
        '/api/snowflake/databases',
        '/api/snowflake/schemas',
        '/api/snowflake/stages',
        '/api/snowflake/stages/test_stage/files',
        '/api/snowflake/test',
      ]

      for (const path of endpoints) {
        const response = await fetch(`${BACKEND_URL}${path}`)
        // Should NOT be 404 - the route should be registered
        // Other errors (422 for missing params, 500 for no connection) are fine
        expect(response.status).not.toBe(404)
      }
    })

    it('should return 404 for non-existent download job', async () => {
      const response = await fetch(
        `${BACKEND_URL}/api/snowflake/download-status/non-existent-id`
      )
      expect(response.status).toBe(404)
    })

    it('should have oauth initiate-with-account endpoint registered', async () => {
      const response = await fetch(
        `${BACKEND_URL}/api/integrations/snowflake/oauth/initiate-with-account`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      )
      // Should NOT be 404 - 422 for validation error is expected
      expect(response.status).not.toBe(404)
    })
  })
})
