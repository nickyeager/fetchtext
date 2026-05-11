import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import fsSync from 'node:fs';
import { request } from '@playwright/test';
import fs from 'node:fs/promises';

// Path for persisted authenticated storage
const AUTH_STATE_PATH = 'playwright/.auth/user.json';

function loadE2EEnv() {
  loadEnv();
  const candidates = [
    '.env.e2e',
    path.resolve('.env.e2e'),
    path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../.env.e2e'),
  ];
  for (const p of candidates) {
    try {
      if (fsSync.existsSync(p)) {
        const result = loadEnv({ path: p, override: true });
        if (Object.keys(result.parsed || {}).length > 0) break;
      }
    } catch { /* ignore */ }
  }
  if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
    for (const p of candidates) {
      try {
        if (fsSync.existsSync(p)) {
          const content = fsSync.readFileSync(p, 'utf-8');
          for (const line of content.split(/\r?\n/)) {
            const m = line.match(/^(TEST_USER_EMAIL|TEST_USER_PASSWORD|SUPABASE_URL|SUPABASE_ANON_KEY)=(.*)$/);
            if (m) {
              const [, key, val] = m;
              if (!process.env[key]) process.env[key] = val.trim();
            }
          }
        }
      } catch { /* ignore */ }
    }
  }
}

async function assertFrontendHealthy(base: string) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 4000);
  try {
    const res = await fetch(base + '/', { signal: ac.signal });
    if (!res.ok) throw new Error(`Non-200 status: ${res.status}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[health] Frontend not responding at ${base}: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSupabaseSession(): Promise<{ authPayload: any }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { TEST_USER_EMAIL, TEST_USER_PASSWORD, SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) return Promise.reject(new Error('MISSING_CREDS'));
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('[auth] Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.');
  const ctx = await request.newContext({
    baseURL: SUPABASE_URL,
    extraHTTPHeaders: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  const resp = await ctx.post('/auth/v1/token?grant_type=password', {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  if (resp.status() !== 200) {
    const body = await resp.text();
    throw new Error(`[auth] Supabase password grant failed: ${resp.status()} ${body}`);
  }
  const json = await resp.json();
  if (!json?.access_token || !json?.user) throw new Error('[auth] Unexpected Supabase auth response payload.');
  return { authPayload: { currentSession: json, currentUser: json.user } };
}

async function writeStorageState(payload: { authPayload: any }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  // Supabase v2 expects the session data directly, not wrapped in currentSession
  const session = payload.authPayload.currentSession;
  const storageState = {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:5173',
        localStorage: [
          // Supabase v2 stores the raw session data
          { name: 'localai-supabase-auth', value: JSON.stringify(session) },
        ],
      },
    ],
  };
  await fs.mkdir('playwright/.auth', { recursive: true });
  await fs.writeFile(AUTH_STATE_PATH, JSON.stringify(storageState, null, 2));
  if (process.env.E2E_AUTH_DEBUG) {
    // eslint-disable-next-line no-console
    console.log('[auth] Wrote storage state to', AUTH_STATE_PATH);
  }
}

async function globalSetup() {
  if (process.env.E2E_SKIP_GLOBAL_SETUP === '1') return;
  loadE2EEnv();
  const frontendBase = process.env.BASE_URL || 'http://localhost:5173';
  await assertFrontendHealthy(frontendBase);
  try {
    const { authPayload } = await fetchSupabaseSession();
    await writeStorageState({ authPayload });
  } catch (err) {
    if (err instanceof Error && err.message === 'MISSING_CREDS') {
      // Silent skip when creds not provided
      return;
    }
    throw err;
  }
}

export default globalSetup;
