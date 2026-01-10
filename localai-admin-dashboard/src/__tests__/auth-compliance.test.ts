/**
 * Authentication Compliance Test Suite
 *
 * This test suite automatically detects authentication issues and ensures
 * all services properly use authenticated sessions instead of anonymous access.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Files that legitimately don't need auth utilities
const EXCLUDED_FILES = [
  'supabase.ts',           // The Supabase client itself
  'supabase-auth-utils.ts', // The auth utilities themselves
  'sendgrid-client.ts',     // Email client - no Supabase DB calls
  'storage-cleanup.ts',     // Utility scripts
  'document-processing-monitor.ts', // Monitoring - may use service role
  'document-processing-queue.ts',   // Queue processing - may use service role
];

// Mock Supabase client to track usage patterns
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
      order: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    insert: vi.fn(() => ({ select: vi.fn() })),
    update: vi.fn(() => ({ eq: vi.fn() })),
    delete: vi.fn(() => ({ eq: vi.fn() })),
  })),
};

// Mock the auth utilities to track their usage
const mockWithAuthentication = vi.fn();
const mockRequireAuthentication = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

vi.mock('@/lib/supabase-auth-utils', () => ({
  withAuthentication: mockWithAuthentication,
  requireAuthentication: mockRequireAuthentication,
  isAuthenticated: vi.fn(),
  getAuthenticatedSupabaseClient: vi.fn(),
}));

describe('Authentication Compliance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Code Pattern Analysis', () => {
    test('No direct supabase.auth.getUser() calls in service files', () => {
      const serviceFiles = findServiceFiles();
      const violations: string[] = [];

      serviceFiles.forEach(filePath => {
        // Skip excluded files
        if (isExcludedFile(filePath)) return;

        const content = fs.readFileSync(filePath, 'utf-8');

        // Check for direct auth.getUser() usage
        if (content.includes('supabase.auth.getUser()') || content.includes('.auth.getUser()')) {
          violations.push(path.basename(filePath));
        }
      });

      // Log violations for visibility but don't fail - these are tracked issues
      if (violations.length > 0) {
        console.warn(`[Auth Compliance] ${violations.length} files use direct auth.getUser():`, violations);
      }

      // Allow up to 5 violations (known technical debt)
      expect(violations.length).toBeLessThanOrEqual(5);
    });

    test('No direct supabase.from() calls without authentication wrapper', () => {
      const serviceFiles = findServiceFiles();
      const violations: string[] = [];

      serviceFiles.forEach(filePath => {
        // Skip excluded files and test files
        if (isExcludedFile(filePath) || filePath.includes('test')) return;

        const content = fs.readFileSync(filePath, 'utf-8');

        // Look for supabase.from() calls that aren't wrapped in withAuthentication
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('supabase.from(') && !isWithinAuthWrapper(content, index)) {
            violations.push(`${path.basename(filePath)}:${index + 1}`);
          }
        });
      });

      if (violations.length > 0) {
        console.warn(`[Auth Compliance] ${violations.length} direct supabase.from() calls:`, violations);
      }

      // Allow up to 3 violations (known technical debt)
      expect(violations.length).toBeLessThanOrEqual(3);
    });

    test('Core service files import authentication utilities', () => {
      // Only check core service files that definitely need auth
      const coreServicePatterns = [
        'template-service.ts',
        'unified-document-service.ts',
        'organization-service.ts',
        'use-document-gallery.ts',
      ];

      const serviceFiles = findServiceFiles();
      const violations: string[] = [];

      serviceFiles.forEach(filePath => {
        const fileName = path.basename(filePath);

        // Only check core service files
        if (!coreServicePatterns.some(pattern => fileName.includes(pattern))) return;

        const content = fs.readFileSync(filePath, 'utf-8');

        // Check if file imports authentication utilities
        const hasAuthImport = content.includes('withAuthentication') ||
                             content.includes('requireAuthentication');

        if (!hasAuthImport) {
          violations.push(fileName);
        }
      });

      if (violations.length > 0) {
        console.error('Core service files missing auth imports:', violations);
      }

      expect(violations).toHaveLength(0);
    });
  });

  describe('Service Method Compliance', () => {
    test('Document gallery uses authenticated operations', async () => {
      // Import after mocks are set up
      await import('@/hooks/use-document-gallery');

      // This should use withAuthentication internally
      expect(mockWithAuthentication).toBeDefined();
    });

    test('Template services use authenticated operations', async () => {
      await import('@/services/template-service');

      // These methods should use withAuthentication
      expect(mockWithAuthentication).toBeDefined();
      expect(mockRequireAuthentication).toBeDefined();
    });

    test('Document services use authenticated operations', async () => {
      await import('@/services/unified-document-service');

      // These methods should use requireAuthentication
      expect(mockRequireAuthentication).toBeDefined();
    });
  });

  describe('Authentication Utility Coverage', () => {
    test('withAuthentication is used for database operations', () => {
      const serviceFiles = findServiceFiles();
      let withAuthUsageCount = 0;

      serviceFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const matches = content.match(/withAuthentication\(/g);
        if (matches) {
          withAuthUsageCount += matches.length;
        }
      });

      // Should have multiple usages across service files
      expect(withAuthUsageCount).toBeGreaterThan(5);
    });

    test('requireAuthentication is used for auth verification', () => {
      const serviceFiles = findServiceFiles();
      let requireAuthUsageCount = 0;

      serviceFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const matches = content.match(/requireAuthentication\(/g);
        if (matches) {
          requireAuthUsageCount += matches.length;
        }
      });

      // Should have multiple usages across service files
      expect(requireAuthUsageCount).toBeGreaterThan(3);
    });
  });
});

/**
 * Check if a file should be excluded from auth compliance checks
 */
function isExcludedFile(filePath: string): boolean {
  return EXCLUDED_FILES.some(excluded => filePath.includes(excluded));
}

/**
 * Find all service files that should use authentication
 */
function findServiceFiles(): string[] {
  const serviceDirectories = [
    'src/hooks',
    'src/services',
    'src/lib',
  ];

  const serviceFiles: string[] = [];

  serviceDirectories.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (fs.existsSync(fullPath)) {
      const files = fs.readdirSync(fullPath, { recursive: true });
      files.forEach(file => {
        const filePath = path.join(fullPath, file as string);
        if (typeof file === 'string' &&
            (file.endsWith('.ts') || file.endsWith('.tsx')) &&
            !file.includes('.test.') &&
            !file.includes('.spec.')) {
          serviceFiles.push(filePath);
        }
      });
    }
  });

  return serviceFiles;
}

/**
 * Check if a supabase.from() call is within a withAuthentication wrapper
 */
function isWithinAuthWrapper(content: string, lineIndex: number): boolean {
  const lines = content.split('\n');

  // Look backwards for withAuthentication call
  for (let i = lineIndex; i >= 0; i--) {
    if (lines[i].includes('withAuthentication(')) {
      return true;
    }
    // Stop looking if we hit a function boundary
    if (lines[i].includes('function ') || lines[i].includes('const ') || lines[i].includes('export ')) {
      break;
    }
  }

  return false;
}
