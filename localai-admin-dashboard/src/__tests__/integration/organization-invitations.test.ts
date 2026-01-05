/**
 * Integration Test: Organization Invitations RLS Policies
 *
 * Tests that RLS policies work correctly for organization_invitations table.
 * Uses direct HTTP requests to match frontend behavior.
 *
 * Bug: Frontend getting 403 Forbidden on organization_invitations queries
 * Expected: Authenticated org members should be able to SELECT/INSERT
 *
 * Requires local Docker Supabase to be running on port 8000.
 */

import { describe, it, expect, beforeAll } from 'vitest';

const SUPABASE_URL = 'http://localhost:8000';

// Service role key bypasses RLS
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTUyNDQ1MjMsImV4cCI6MTc4Njc4MDUyM30.ZqVkrssfyf7SCS077wBdEJLOuCgXgkSTJmhyH8JoePM';

// Anon key for testing RLS
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU1MjQ0NTIzLCJleHAiOjE3ODY3ODA1MjN9.h6VsUD-W6BuvpX5giP6Q-WSKrwQa6-2PPlAPFUzvtzU';

// Test data from local seed
const TEST_USER_ID = '9165d51e-f19f-4743-915e-86c44372bc61';
const TEST_ORG_ID = '3e153efc-9a54-41db-8ad4-4457b9fb05ab';

describe('Organization Invitations RLS', () => {
  let accessToken: string;

  beforeAll(async () => {
    // Get a session for the test user using admin API
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${TEST_USER_ID}`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.log('Admin API response:', response.status, text);
      throw new Error(`Failed to get user: ${response.status}`);
    }

    const userData = await response.json();
    console.log('Found user:', userData.email);

    // Generate magic link
    const linkResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'magiclink',
        email: userData.email,
      }),
    });

    if (!linkResponse.ok) {
      throw new Error(`Failed to generate link: ${linkResponse.status}`);
    }

    const linkData = await linkResponse.json();
    const actionLink = linkData.action_link;
    const tokenHash = linkData.hashed_token;

    if (!actionLink || !tokenHash) {
      console.log('Link response:', JSON.stringify(linkData, null, 2));
      throw new Error('No action link or token in response');
    }

    // Verify OTP to get session
    const verifyResponse = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'magiclink',
        token_hash: tokenHash,
      }),
    });

    if (!verifyResponse.ok) {
      throw new Error(`Failed to verify: ${verifyResponse.status}`);
    }

    const session = await verifyResponse.json();
    accessToken = session.access_token;

    if (!accessToken) {
      throw new Error('No access token in session');
    }

    console.log('Got access token for user:', userData.email);
  });

  it('should allow authenticated org members to SELECT invitations', async () => {
    // This is the exact query the frontend makes
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/organization_invitations?` +
        `organization_id=eq.${TEST_ORG_ID}&` +
        `status=eq.pending&` +
        `order=created_at.desc&` +
        `select=*`,
      {
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Expected: 200 OK with array (may be empty)
    // Bug: Returns 403 Forbidden
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should allow org admins/owners to INSERT new invitations', async () => {
    const testEmail = `test-invite-${Date.now()}@example.com`;

    const response = await fetch(`${SUPABASE_URL}/rest/v1/organization_invitations`, {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        organization_id: TEST_ORG_ID,
        email: testEmail,
        role: 'member',
        invited_by: TEST_USER_ID,
        status: 'pending',
      }),
    });

    // Expected: 201 Created
    // Bug: Returns 403 Forbidden
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data[0]?.email).toBe(testEmail);

    // Cleanup
    if (data[0]?.id) {
      await fetch(`${SUPABASE_URL}/rest/v1/organization_invitations?id=eq.${data[0].id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      });
    }
  });

  it('should allow checking for existing pending invitations', async () => {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/organization_invitations?` +
        `organization_id=eq.${TEST_ORG_ID}&` +
        `email=eq.nonexistent@example.com&` +
        `status=eq.pending&` +
        `select=id`,
      {
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Expected: 200 OK with empty array (not 403)
    expect(response.status).toBe(200);
  });

  it('should allow new user signup (creates personal org via trigger)', async () => {
    // This tests the signup flow that was failing with 500 error due to
    // function signature mismatch: create_personal_organization(uuid, varchar) not found
    //
    // Note: Local environments may fail on email confirmation. We test using admin API
    // to create a user, which bypasses email sending but still triggers the org creation.
    const testEmail = `invited-signup-${Date.now()}@example.com`;

    // Use admin API to create user (bypasses email sending issues in local env)
    const createUserResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: 'TestPassword123!',
        email_confirm: true, // Skip email confirmation
      }),
    });

    console.log('Create user response status:', createUserResponse.status);

    if (!createUserResponse.ok) {
      const errorText = await createUserResponse.text();
      console.error('Create user error:', errorText);
    }

    // Expected: 200 OK with user data
    // Bug was: 500 Internal Server Error due to missing function overload for trigger
    expect(createUserResponse.status).toBe(200);

    const userData = await createUserResponse.json();
    expect(userData.id).toBeDefined();
    expect(userData.email).toBe(testEmail);

    const userId = userData.id;

    // Verify personal organization was created by the trigger
    const orgResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/organization_members?user_id=eq.${userId}&select=*,organization:organizations(*)`,
      {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );

    const orgs = await orgResponse.json();
    console.log('User organizations:', JSON.stringify(orgs, null, 2));

    // Should have a personal organization created by the trigger
    expect(orgs.length).toBeGreaterThan(0);
    expect(orgs[0].organization?.organization_type).toBe('personal');

    // Cleanup - delete the test user (this cascades to orgs)
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });
  });

  it('should fetch invitation by token with organization and inviter details', async () => {
    // First, create a test invitation using service role
    const testEmail = `invited-user-${Date.now()}@example.com`;

    const createResponse = await fetch(`${SUPABASE_URL}/rest/v1/organization_invitations`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        organization_id: TEST_ORG_ID,
        email: testEmail,
        role: 'member',
        invited_by: TEST_USER_ID,
        status: 'pending',
      }),
    });

    expect(createResponse.status).toBe(201);
    const [invitation] = await createResponse.json();
    const token = invitation.token;
    console.log('Created test invitation with token:', token?.substring(0, 10) + '...');

    try {
      // This is the EXACT query from organization-service.ts:getInvitationByToken
      // that fails with 400 Bad Request because auth_user_view doesn't exist
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/organization_invitations?` +
          `token=eq.${token}&` +
          `select=*,organization:organizations(id,name,slug,logo_url),inviter:auth_user_view(id,email)`,
        {
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Expected: 200 OK with invitation details including organization and inviter
      // Bug: Returns 400 Bad Request because auth_user_view doesn't exist
      console.log('Invitation by token response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Invitation fetch error:', errorText);
      }

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.length).toBe(1);
      expect(data[0].token).toBe(token);
      expect(data[0].organization).toBeDefined();
      expect(data[0].inviter).toBeDefined();
    } finally {
      // Cleanup - delete the test invitation
      await fetch(`${SUPABASE_URL}/rest/v1/organization_invitations?id=eq.${invitation.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      });
    }
  });
});
