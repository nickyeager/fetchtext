/**
 * Standalone Azure Provisioning API Test
 *
 * Run directly with: node tests/e2e/settings/test-provisioning-api.mjs
 *
 * Tests all provisioning API endpoints without needing the frontend.
 */

const BACKEND_URL = 'http://localhost:8090';

const results = [];

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function test(name, fn) {
  log(`\n  Running: ${name}`);
  try {
    await fn();
    results.push({ name, passed: true });
    log(`  PASSED: ${name}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMessage });
    log(`  FAILED: ${name}`);
    log(`   Error: ${errorMessage}`);
  }
}

function expect(value) {
  return {
    toBe(expected) {
      if (value !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
      }
    },
    toContain(expected) {
      if (Array.isArray(value)) {
        if (!value.includes(expected)) {
          throw new Error(`Expected array to contain ${JSON.stringify(expected)}`);
        }
      } else if (typeof value === 'string') {
        if (!value.includes(String(expected))) {
          throw new Error(`Expected string to contain ${JSON.stringify(expected)}`);
        }
      }
    },
    toHaveProperty(prop) {
      if (typeof value !== 'object' || value === null || !(prop in value)) {
        throw new Error(`Expected object to have property '${prop}'`);
      }
    },
  };
}

async function main() {
  console.log('');
  console.log('================================================');
  console.log('Azure OpenAI Provisioning API Tests');
  console.log('================================================');
  console.log(`Backend URL: ${BACKEND_URL}`);
  console.log('');

  // Health check
  await test('Backend health check', async () => {
    const response = await fetch(`${BACKEND_URL}/health`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('healthy');
    log(`   Health: ${JSON.stringify(data)}`);
  });

  const testOrgId = '00000000-0000-0000-0000-000000000001';

  // Test: GET /models/provision/{org_id}/status
  await test('GET provisioning status', async () => {
    const response = await fetch(`${BACKEND_URL}/models/provision/${testOrgId}/status`);
    expect(response.status).toBe(200);

    const data = await response.json();
    log(`   Response: ${JSON.stringify(data, null, 2)}`);

    expect(data).toHaveProperty('organization_id');
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('region');
    expect(data).toHaveProperty('progress_steps');
    expect(data.organization_id).toBe(testOrgId);

    const validStatuses = ['pending', 'provisioning', 'active', 'failed', 'deprovisioning'];
    expect(validStatuses).toContain(data.status);
  });

  // Test: GET /models/provision/{org_id}/logs
  await test('GET provisioning logs', async () => {
    const response = await fetch(`${BACKEND_URL}/models/provision/${testOrgId}/logs`);
    expect(response.status).toBe(200);

    const data = await response.json();
    log(`   Logs count: ${data.logs?.length || 0}`);

    expect(data).toHaveProperty('organization_id');
    expect(data).toHaveProperty('logs');
    expect(data.organization_id).toBe(testOrgId);
  });

  // Test: POST /models/provision/{org_id} (should fail without Azure credentials)
  await test('POST trigger provisioning (expect 503 - not configured)', async () => {
    const response = await fetch(`${BACKEND_URL}/models/provision/${testOrgId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected_model: 'gpt-4o-mini' }),
    });

    const data = await response.json();
    log(`   Status: ${response.status}`);
    log(`   Response: ${JSON.stringify(data, null, 2)}`);

    // Should be 503 (not configured) or 200 (configured)
    if (response.status === 503) {
      expect(data.detail).toContain('not configured');
      log('   Correctly reports Azure not configured');
    } else if (response.status === 200) {
      expect(data).toHaveProperty('success');
      log('   Azure is configured and provisioning started');
    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  });

  // Test: DELETE /models/provision/{org_id}
  await test('DELETE deprovision', async () => {
    const response = await fetch(`${BACKEND_URL}/models/provision/${testOrgId}`, {
      method: 'DELETE',
    });
    expect(response.status).toBe(200);

    const data = await response.json();
    log(`   Response: ${JSON.stringify(data, null, 2)}`);

    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('message');
    expect(data).toHaveProperty('organization_id');
  });

  // Test: Invalid org ID
  await test('Reject invalid organization ID', async () => {
    const response = await fetch(`${BACKEND_URL}/models/provision/invalid-uuid/status`);

    // Should reject with 400 or 422
    if (response.status !== 400 && response.status !== 422) {
      throw new Error(`Expected 400 or 422, got ${response.status}`);
    }
    log(`   Correctly rejected with status: ${response.status}`);
  });

  // Test: Concurrent requests
  await test('Handle concurrent requests', async () => {
    const orgIds = [
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003',
    ];

    const responses = await Promise.all(
      orgIds.map(id => fetch(`${BACKEND_URL}/models/provision/${id}/status`))
    );

    for (let i = 0; i < responses.length; i++) {
      expect(responses[i].status).toBe(200);
      const data = await responses[i].json();
      expect(data.organization_id).toBe(orgIds[i]);
    }
    log(`   All ${orgIds.length} concurrent requests handled correctly`);
  });

  // Summary
  console.log('');
  console.log('================================================');
  console.log('TEST SUMMARY');
  console.log('================================================');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  for (const result of results) {
    const icon = result.passed ? 'PASS' : 'FAIL';
    console.log(`[${icon}] ${result.name}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  console.log('');
  console.log(`Total: ${results.length} tests`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('================================================');

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
