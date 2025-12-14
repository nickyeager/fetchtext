import { test, expect } from '@playwright/test';
import { preflight } from './utils/preflight';

test.describe('Authentication Verification', () => {
  test.beforeEach(async () => {
    // Run preflight checks
    await preflight();
  });

  test('Supabase auth endpoints are accessible', async ({ request }) => {
    // Test auth health endpoint
    const healthResponse = await request.get('http://localhost:8000/auth/v1/health');
    expect(healthResponse.ok()).toBeTruthy();
    
    const healthData = await healthResponse.json();
    expect(healthData.name).toBe('GoTrue');
    expect(healthData.version).toMatch(/v\d+\.\d+\.\d+/);
  });

  test('PostgREST is accessible via Kong', async ({ request }) => {
    // Test PostgREST endpoint (should return 200 for base route)
    const restResponse = await request.get('http://localhost:8000/rest/v1/');
    expect(restResponse.status()).toBe(200); // Kong routes correctly
  });

  test('Storage API is accessible via Kong', async ({ request }) => {
    // Test storage status endpoint
    const storageResponse = await request.get('http://localhost:8000/storage/v1/status');
    expect(storageResponse.ok()).toBeTruthy();
    
    // Storage status endpoint returns empty body with 200, which is valid
    expect(storageResponse.status()).toBe(200);
  });

  test('Frontend loads and renders correctly', async ({ page }) => {
    await page.goto('http://localhost:5174');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check if the page loads with expected content
    const pageTitle = await page.title();
    expect(pageTitle).toContain('FetchText Admin');
    
    // Check that the page loaded (not a 404 or error page)
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy(); // Should have some content
    
    // Verify it's our app and not an error page
    expect(pageContent).not.toContain('404');
    expect(pageContent).not.toContain('Cannot GET');
  });

  test('Kong proxy routes are working', async ({ request }) => {
    // Test that Kong is properly routing requests
    const responses = await Promise.all([
      request.get('http://localhost:8000/auth/v1/health'),
      request.get('http://localhost:8000/rest/v1/'),
      request.get('http://localhost:8000/storage/v1/status')
    ]);
    
    // All should be routed successfully (even if some return auth errors, they shouldn't be connection errors)
    responses.forEach((response) => {
      expect(response.status()).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(500); // No server errors
    });
  });
});
