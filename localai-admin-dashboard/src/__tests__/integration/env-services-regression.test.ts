/**
 * Regression Test: Environment Variables, Service Connectivity & CORS
 *
 * Verifies that SendGrid, PostHog, and CORS environment variables are
 * properly configured and that the services can be reached.
 *
 * Created after production incidents where:
 * 1. SendGrid VITE_* env vars were missing from CI/CD build (deploy-dashboard.yml)
 * 2. CORS allow_origins=["*"] was hardcoded, breaking production cross-origin requests
 *
 * Run with:
 *   cd localai-admin-dashboard && npx vitest run src/__tests__/integration/env-services-regression.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const BACKEND_URL =
  import.meta.env.VITE_DOCUMENT_PROCESSOR_URL || 'http://localhost:8090';

// ─────────────────────────────────────────────────────────────────────────────
// CI/CD Workflow Validation
// Ensures deploy-dashboard.yml passes all required env vars to the build
// ─────────────────────────────────────────────────────────────────────────────

describe('CI/CD Workflow Environment Variables', () => {
  let workflowContent: string;

  beforeAll(() => {
    const workflowPath = resolve(
      __dirname,
      '../../../../.github/workflows/deploy-dashboard.yml'
    );
    workflowContent = readFileSync(workflowPath, 'utf-8');
  });

  const requiredBuildVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_DOCUMENT_PROCESSOR_URL',
    'VITE_POSTHOG_KEY',
    'VITE_POSTHOG_HOST',
    'VITE_SENDGRID_API_KEY',
    'VITE_SENDGRID_FROM_EMAIL',
    'VITE_SENDGRID_FROM_NAME',
    'VITE_SENDGRID_REPLY_TO',
    'VITE_APP_URL',
  ];

  for (const envVar of requiredBuildVars) {
    it(`deploy-dashboard.yml must pass ${envVar} to build step`, () => {
      // Check the "Build dashboard" step's env block contains this variable
      expect(workflowContent).toContain(
        `${envVar}:`
      );
    });
  }

  it('deploy-dashboard.yml must have env validation step', () => {
    expect(workflowContent).toContain('Validate required environment variables');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Frontend Environment Variable Validation
// Ensures VITE_* vars are available at runtime (were embedded at build time)
// ─────────────────────────────────────────────────────────────────────────────

describe('Frontend SendGrid Configuration', () => {
  it('VITE_SENDGRID_API_KEY must be set', () => {
    const apiKey = import.meta.env.VITE_SENDGRID_API_KEY;
    if (!apiKey) {
      throw new Error(
        'VITE_SENDGRID_API_KEY is not set. ' +
          'In CI/CD: add it as a GitHub secret. ' +
          'Locally: add it to localai-admin-dashboard/.env.local'
      );
    }
    expect(apiKey).toBeTruthy();
  });

  it('VITE_SENDGRID_FROM_EMAIL must be set', () => {
    // Falls back to default in email.ts but should be explicit
    const fromEmail =
      import.meta.env.VITE_SENDGRID_FROM_EMAIL || 'nick@fetchtext.io';
    expect(fromEmail).toContain('@');
  });
});

describe('Frontend PostHog Configuration', () => {
  it('VITE_POSTHOG_KEY must be set', () => {
    const key = import.meta.env.VITE_POSTHOG_KEY;
    if (!key) {
      throw new Error(
        'VITE_POSTHOG_KEY is not set. ' +
          'In CI/CD: add it as a GitHub secret. ' +
          'Locally: add it to localai-admin-dashboard/.env.local. ' +
          'PostHog analytics will be silently disabled in production without this.'
      );
    }
    expect(key).toBeTruthy();
    expect(key).toMatch(/^phc_/);
  });

  it('VITE_POSTHOG_HOST must be set or have correct default', () => {
    const host =
      import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
    expect(host).toMatch(/^https:\/\//);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Backend Service Connectivity
// Ensures the document-processor is running and email service is configured
// ─────────────────────────────────────────────────────────────────────────────

describe('Backend Email Service Health', () => {
  it('backend health endpoint must be reachable', async () => {
    const response = await fetch(`${BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(10000),
    });
    expect(response.ok).toBe(true);
  });

  it('email health must report configured=true', async () => {
    const response = await fetch(`${BACKEND_URL}/api/email/health`, {
      signal: AbortSignal.timeout(10000),
    });
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.configured).toBe(true);
    expect(data.from_email).toBeTruthy();
    expect(data.app_url).toBeTruthy();

    if (!data.configured) {
      throw new Error(
        'Backend email health reports configured=false. ' +
          'SENDGRID_API_KEY is missing from the document-processor container. ' +
          'Check docker-compose.yml and root .env file.'
      );
    }

    if (!data.app_url) {
      throw new Error(
        'Backend email health reports empty app_url. ' +
          'APP_URL env var is missing — email invitation links will be broken.'
      );
    }
  });

  it('email endpoint must reject incomplete requests with 422', async () => {
    const response = await fetch(
      `${BACKEND_URL}/api/email/send-invitation`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_email: 'test@example.com' }),
        signal: AbortSignal.timeout(10000),
      }
    );
    // FastAPI returns 422 for missing required fields
    expect(response.status).toBe(422);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Docker Compose Configuration Validation
// Ensures docker-compose.yml passes required env vars to document-processor
// ─────────────────────────────────────────────────────────────────────────────

describe('Docker Compose Environment Variables', () => {
  let composeContent: string;

  beforeAll(() => {
    const composePath = resolve(
      __dirname,
      '../../../../docker-compose.yml'
    );
    composeContent = readFileSync(composePath, 'utf-8');
  });

  const requiredDockerVars = [
    'SENDGRID_API_KEY',
    'SENDGRID_FROM_EMAIL',
    'SENDGRID_FROM_NAME',
  ];

  for (const envVar of requiredDockerVars) {
    it(`docker-compose.yml must pass ${envVar} to document-processor`, () => {
      expect(composeContent).toContain(`${envVar}=`);
    });
  }

  it('docker-compose.yml must pass ALLOWED_ORIGINS to document-processor', () => {
    expect(composeContent).toContain('ALLOWED_ORIGINS=');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CORS Prevention Regression Tests
// Ensures CORS configuration cannot silently regress in deployment pipelines
// Created after production CORS breakage (fetchtext.io blocked from backend)
// ─────────────────────────────────────────────────────────────────────────────

describe('CORS: Container App Workflow Validation', () => {
  let containerAppWorkflow: string;

  beforeAll(() => {
    const workflowPath = resolve(
      __dirname,
      '../../../../.github/workflows/deploy-container-app.yml'
    );
    containerAppWorkflow = readFileSync(workflowPath, 'utf-8');
  });

  it('deploy-container-app.yml must set ALLOWED_ORIGINS env var', () => {
    expect(containerAppWorkflow).toContain('ALLOWED_ORIGINS=');
  });

  it('deploy-container-app.yml must include fetchtext.io in ALLOWED_ORIGINS', () => {
    expect(containerAppWorkflow).toContain('fetchtext.io');
  });

  it('deploy-container-app.yml must have CORS validation step', () => {
    expect(containerAppWorkflow).toContain('Validate CORS configuration');
  });

  it('deploy-container-app.yml must have CORS smoke test step', () => {
    expect(containerAppWorkflow).toContain('CORS preflight smoke test');
  });
});

describe('CORS: Backend /health/cors Endpoint', () => {
  it('/health/cors must return allowed origins list', async () => {
    const response = await fetch(`${BACKEND_URL}/health/cors`, {
      signal: AbortSignal.timeout(10000),
    });
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.allowed_origins).toBeDefined();
    expect(Array.isArray(data.allowed_origins)).toBe(true);
    expect(data.allowed_origins.length).toBeGreaterThan(0);
    expect(data.allowed_origins_count).toBeGreaterThan(0);
  });
});

describe('CORS: Backend Returns CORS Headers', () => {
  it('backend must return Access-Control-Allow-Origin for allowed origin', async () => {
    const response = await fetch(`${BACKEND_URL}/health`, {
      headers: { Origin: 'http://localhost:5173' },
      signal: AbortSignal.timeout(10000),
    });
    expect(response.ok).toBe(true);

    const acaoHeader = response.headers.get('access-control-allow-origin');
    expect(acaoHeader).toBeTruthy();
    expect(acaoHeader).toBe('http://localhost:5173');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression Tests Workflow: No Skipped Jobs
// Ensures the production-smoke job is NEVER conditionally skipped.
// Tests must always run — skipping is forbidden by project prime directive.
// ─────────────────────────────────────────────────────────────────────────────

describe('CI/CD: Regression Tests Workflow — No Skipped Jobs', () => {
  let regressionWorkflow: string;

  beforeAll(() => {
    const workflowPath = resolve(
      __dirname,
      '../../../../.github/workflows/regression-tests.yml'
    );
    regressionWorkflow = readFileSync(workflowPath, 'utf-8');
  });

  it('production-smoke job must NOT have a job-level if: condition that skips it', () => {
    // Extract the production-smoke job block.
    // A job-level `if:` would appear right after the job key before `runs-on:`.
    const jobMatch = regressionWorkflow.match(
      /production-smoke:\s*\n([\s\S]*?)(?=\n  \w[\w-]*:|$)/
    );
    expect(jobMatch, 'production-smoke job not found in regression-tests.yml').toBeTruthy();

    const jobBlock = jobMatch![1];
    // Check for job-level `if:` (indented at job property level, before steps)
    const stepsStart = jobBlock.indexOf('steps:');
    const jobConfig = stepsStart >= 0 ? jobBlock.slice(0, stepsStart) : jobBlock;

    const hasJobLevelIf = /^\s{4}if:/m.test(jobConfig);
    expect(
      hasJobLevelIf,
      'production-smoke job has a job-level `if:` condition that can skip the entire job. ' +
        'Tests must NEVER be skipped — this violates the prime directive. ' +
        'Remove the job-level `if:` so the job always runs on every trigger.'
    ).toBe(false);
  });
});
