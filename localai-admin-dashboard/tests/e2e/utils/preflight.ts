import 'dotenv/config';

/** Options for preflight */
export interface PreflightOptions {
  healthTimeoutMs?: number;
  log?: (...args: unknown[]) => void;
}

/**
 * Perform environment + backend health validation prior to running an E2E test.
 * - Validates required env vars
 * - Probes document processor + Supabase gateway in parallel
 * - Does NOT enforce E2E_SKIP_GLOBAL_SETUP; only logs its presence
 */
export async function preflight(opts: PreflightOptions = {}): Promise<void> {
  // Internal logger honoring E2E_DEBUG
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defaultLogger = (...a: any[]) => { if (process.env.E2E_DEBUG) { /* eslint-disable no-console */ console.log('[preflight]', ...a); /* eslint-enable no-console */ } };
  const { healthTimeoutMs = 3000, log = defaultLogger } = opts;
  const requiredEnv = ['TEST_USER_EMAIL','TEST_USER_PASSWORD','SUPABASE_URL','SUPABASE_ANON_KEY'];
  const missing = requiredEnv.filter(k => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required E2E env vars: ${missing.join(', ')} (configure in .env.e2e)`);
  }
  if (process.env.E2E_SKIP_GLOBAL_SETUP === '1') {
    log('Detected E2E_SKIP_GLOBAL_SETUP=1 (global auth storage state will be skipped).');
  } else {
    log('Global setup expected to have produced storage state (E2E_SKIP_GLOBAL_SETUP not set).');
  }

  async function quickCheck(name: string, url: string, opts?: { acceptStatus?: (code: number) => boolean }) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), healthTimeoutMs);
    const start = Date.now();
    try {
      const resp = await fetch(url, { signal: ac.signal });
      const accept = opts?.acceptStatus || ((code: number) => code >= 200 && code < 300);
      if (!accept(resp.status)) throw new Error(`Unexpected status ${resp.status}`);
      log(`${name} OK (${Date.now() - start}ms)`);
    } catch (e) {
      throw new Error(`[health] ${name} unreachable at ${url}: ${(e as Error).message}`);
    } finally {
      clearTimeout(t);
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL!;
  // Document processor must return 200 OK on /health
  // Supabase gateway (Kong) may return 404 on '/', so prefer an auth health endpoint via Kong routing.
  const supabaseHealthPath = process.env.SUPABASE_HEALTH_PATH || '/auth/v1/health';
  const supabaseHealthUrl = new URL(supabaseHealthPath, supabaseUrl).toString();

  await Promise.all([
    quickCheck('document-processor','http://localhost:8090/health'),
    // Accept 200 for /auth/v1/health; if that fails, fallback to base '/' and accept 200/401/404 as proof of reachability
    (async () => {
      try {
        await quickCheck('supabase-gateway', supabaseHealthUrl);
      } catch {
        await quickCheck('supabase-gateway-base', supabaseUrl, { acceptStatus: (c) => c === 200 || c === 401 || c === 404 });
      }
    })()
  ]);
}
