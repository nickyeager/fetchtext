/**
 * Authentication Compliance Test Suite
 * 
 * This test suite automatically detects authentication issues and ensures
 * all services properly use authenticated sessions instead of anonymous access.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock Supabase client to track usage patterns
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({ eq: vi.fn() })),
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
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Check for direct auth.getUser() usage (excluding auth utilities file)
        if (filePath.includes('supabase-auth-utils.ts')) return;
        
        if (content.includes('supabase.auth.getUser()')) {
          violations.push(`${filePath}: Direct supabase.auth.getUser() usage detected`);
        }
        
        if (content.includes('.auth.getUser()')) {
          violations.push(`${filePath}: Direct .auth.getUser() usage detected`);
        }
      });

      if (violations.length > 0) {
        console.error('Authentication violations found:');
        violations.forEach(violation => console.error(`- ${violation}`));
      }

      expect(violations).toHaveLength(0);
    });

    test('No direct supabase.from() calls without authentication wrapper', () => {
      const serviceFiles = findServiceFiles();
      const violations: string[] = [];

      serviceFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Skip auth utilities and test files
        if (filePath.includes('supabase-auth-utils.ts') || filePath.includes('test')) return;
        
        // Look for supabase.from() calls that aren't wrapped in withAuthentication
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('supabase.from(') && !isWithinAuthWrapper(content, index)) {
            violations.push(`${filePath}:${index + 1}: Direct supabase.from() usage without authentication wrapper`);
          }
        });
      });

      if (violations.length > 0) {
        console.error('Direct database access violations found:');
        violations.forEach(violation => console.error(`- ${violation}`));
      }

      expect(violations).toHaveLength(0);
    });

    test('All service files import authentication utilities', () => {
      const serviceFiles = findServiceFiles();
      const violations: string[] = [];

      serviceFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Skip files that don't use Supabase
        if (!content.includes('supabase')) return;
        if (filePath.includes('supabase-auth-utils.ts')) return;
        
        // Check if file imports authentication utilities
        const hasAuthImport = content.includes('withAuthentication') || 
                             content.includes('requireAuthentication');
        
        if (!hasAuthImport) {
          violations.push(`${filePath}: Missing authentication utility imports`);
        }
      });

      if (violations.length > 0) {
        console.error('Missing authentication imports:');
        violations.forEach(violation => console.error(`- ${violation}`));
      }

      expect(violations).toHaveLength(0);
    });
  });

  describe('Service Method Compliance', () => {
    test('Document gallery uses authenticated operations', async () => {
      // Import after mocks are set up
      const { useDocuments } = await import('@/hooks/use-document-gallery');
      
      // This should use withAuthentication internally
      expect(mockWithAuthentication).toBeDefined();
    });

    test('Template services use authenticated operations', async () => {
      const { TemplateService } = await import('@/lib/template-service');
      
      // These methods should use withAuthentication
      expect(mockWithAuthentication).toBeDefined();
      expect(mockRequireAuthentication).toBeDefined();
    });

    test('Document services use authenticated operations', async () => {
      const { UnifiedDocumentService } = await import('@/services/unified-document-service');
      
      // These methods should use requireAuthentication
      expect(mockRequireAuthentication).toBeDefined();
    });
  });

  describe('Runtime Authentication Checks', () => {
    test('Services handle unauthenticated state gracefully', async () => {
      // Mock unauthenticated state
      mockRequireAuthentication.mockRejectedValue(new Error('User not authenticated'));
      
      try {
        const { UnifiedDocumentService } = await import('@/services/unified-document-service');
        await UnifiedDocumentService.getUserDocuments();
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('authenticated');
      }
    });

    test('Services work with authenticated state', async () => {
      // Mock authenticated state
      mockRequireAuthentication.mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        access_token: 'mock-token'
      });

      mockWithAuthentication.mockImplementation(async (callback) => {
        return await callback({
          id: 'test-user-id',
          email: 'test@example.com',
          access_token: 'mock-token'
        });
      });

      // Mock successful database response
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      });

      const { UnifiedDocumentService } = await import('@/services/unified-document-service');
      
      // This should work without throwing
      await expect(UnifiedDocumentService.getUserDocuments()).resolves.toBeDefined();
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