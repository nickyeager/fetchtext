/**
 * Shared E2E environment helper.
 *
 * Provides a single API for test credentials and service URLs that works
 * across both local (localhost) and production (fetchtext.io) targets.
 *
 * Detection logic:
 *   - If `TARGET=production` env var is set, use production values.
 *   - Otherwise, infer from Playwright `baseURL` (contains "fetchtext.io" → production).
 *   - Fallback: local.
 */

export type Target = 'local' | 'production';

/**
 * Detect which target we're running against.
 * Call with `test.info().project.use.baseURL` when available.
 */
export function detectTarget(baseURL?: string): Target {
  if (process.env.TARGET === 'production') return 'production';
  if (baseURL?.includes('fetchtext.io')) return 'production';
  return 'local';
}

export interface Credentials {
  email: string;
  password: string;
}

/**
 * Return test credentials for the active target.
 * Throws if required env vars are missing.
 */
export function getCredentials(target?: Target): Credentials {
  const t = target ?? detectTarget();

  if (t === 'production') {
    const email = process.env.PROD_TEST_USER_EMAIL;
    const password = process.env.PROD_TEST_USER_PASSWORD;
    if (!email || !password) {
      throw new Error(
        'Production credentials not set. ' +
          'Set PROD_TEST_USER_EMAIL and PROD_TEST_USER_PASSWORD in .env.e2e.production'
      );
    }
    return { email, password };
  }

  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Local credentials not set. ' +
        'Set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.e2e'
    );
  }
  return { email, password };
}

/**
 * Return the document-processor backend URL for the active target.
 */
export function getBackendUrl(target?: Target): string {
  const t = target ?? detectTarget();

  if (t === 'production') {
    return (
      process.env.PROD_BACKEND_URL ||
      process.env.VITE_DOCUMENT_PROCESSOR_URL ||
      'https://ft-dev-document-processor-uhqrm5.graystone-50b6fbc2.eastus2.azurecontainerapps.io'
    );
  }

  return process.env.BACKEND_URL || 'http://localhost:8090';
}

/**
 * Return the Supabase URL for the active target.
 */
export function getSupabaseUrl(target?: Target): string {
  const t = target ?? detectTarget();

  if (t === 'production') {
    return (
      process.env.SUPABASE_PROD_URL || 'https://rawhmcrtzfdhryyfovee.supabase.co'
    );
  }

  return process.env.SUPABASE_URL || 'http://localhost:8000';
}
