import { test, expect } from '@playwright/test';
import { findHydratableRoute, attachDiagnostics } from './utils/appAssertions';

// Frontend-only smoke style integration: navigates potential document-related routes and ensures SPA bootstraps.
test.describe('Document UI Smoke (no external service mocks)', () => {
  test('navigates candidate document routes and asserts basic shell renders', async ({ page }, testInfo) => {
    const candidatePaths = [
      '/documents/gallery',
      '/_authenticated/documents/gallery',
      '/documents/workflow',
      '/_authenticated/documents/workflow',
      '/documents',
      '/'
    ];

    const loadedPath = await test.step('probe candidate routes', async () => {
      return await findHydratableRoute(page, candidatePaths);
    });

    if (!loadedPath) {
      await attachDiagnostics(page, testInfo, 'no-route-hydrated');
    }

    expect(loadedPath, 'No candidate document route hydrated successfully').not.toBeNull();
  });
});
