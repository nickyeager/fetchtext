import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentTemplateService } from '../template-service';
import { supabase } from '@/lib/supabase';

// Mock console.error to prevent error output during tests
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock the supabase module
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('DocumentTemplateService', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  const mockSupabaseResponse = {
    data: [
      {
        id: 123,
        uuid: 'template-uuid-123',
        name: 'Test Template',
        description: 'A test template',
        template_content: '<p>Test content</p>',
        template_type: 'document',
        category: 'business',
        variables: [],
        tags: ['test'],
        usage_count: 10,
        is_public: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    ],
    error: null,
  };

  const mockFromChain = {
    select: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(mockSupabaseResponse),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockClear();
    
    // Setup default auth mock
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any);

    // Setup default from mock
    vi.mocked(supabase.from).mockReturnValue(mockFromChain as any);
  });

  describe('getTemplates', () => {
    it('should fetch templates for authenticated user', async () => {
      const templates = await DocumentTemplateService.getTemplates();

      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(supabase.from).toHaveBeenCalledWith('templates');
      expect(mockFromChain.select).toHaveBeenCalledWith('*');
      expect(mockFromChain.or).toHaveBeenCalledWith(`is_public.eq.true,created_by.eq.${mockUser.id}`);
      expect(mockFromChain.order).toHaveBeenCalledWith('usage_count', { ascending: false });
      
      expect(templates).toHaveLength(1);
      expect(templates[0]).toMatchObject({
        id: 123,
        name: 'Test Template',
        description: 'A test template',
        category: 'business',
        smart_variables: [],
        extraction_rules: [],
        generation_settings: {},
        tags: ['test'],
        usage_count: 10,
        rating: 4.2,
      });
    });

    it('should handle unauthenticated user', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as any);

      const templates = await DocumentTemplateService.getTemplates();

      expect(mockFromChain.or).toHaveBeenCalledWith(`is_public.eq.true,created_by.eq.undefined`);
      expect(templates).toHaveLength(1);
    });

    it('should handle database errors', async () => {
      const errorResponse = {
        data: null,
        error: { message: 'Database error' },
      };
      mockFromChain.order.mockResolvedValue(errorResponse);

      await expect(DocumentTemplateService.getTemplates()).rejects.toThrow();
      
      // Verify that console.error was called with the error
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading templates:', errorResponse.error);
    });

    it('should handle empty results', async () => {
      mockFromChain.order.mockResolvedValue({ data: null, error: null });

      const templates = await DocumentTemplateService.getTemplates();

      expect(templates).toEqual([]);
    });

    it('should transform templates to SmartTemplate format with defaults', async () => {
      const rawTemplate = {
        id: 456,
        uuid: 'template-uuid-456',
        name: 'Raw Template',
        description: 'A raw template',
        template_content: '<p>Raw content</p>',
        template_type: 'document',
        category: null, // Will default to 'general'
        variables: [{ id: 'var1', name: 'Variable 1', type: 'text' }],
        tags: null, // Will default to []
        usage_count: null, // Will default to 0
        is_public: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockFromChain.order.mockResolvedValue({
        data: [rawTemplate],
        error: null,
      });

      const templates = await DocumentTemplateService.getTemplates();

      expect(templates[0]).toMatchObject({
        id: 456,
        name: 'Raw Template',
        description: 'A raw template',
        smart_variables: rawTemplate.variables,
        extraction_rules: [],
        generation_settings: {},
        category: 'general', // Default value
        tags: [], // Default value
        usage_count: 0, // Default value
        rating: 4.2, // Mock rating
      });
    });
  });

  describe('service definition', () => {
    it('should import template service successfully', () => {
      expect(DocumentTemplateService).toBeDefined();
      expect(DocumentTemplateService.getTemplates).toBeDefined();
      expect(typeof DocumentTemplateService.getTemplates).toBe('function');
    });

    it('should have getTemplates method', () => {
      expect(DocumentTemplateService.getTemplates).toBeDefined();
      expect(typeof DocumentTemplateService.getTemplates).toBe('function');
    });

    it('should be an object with the expected structure', () => {
      expect(typeof DocumentTemplateService).toBe('object');
      expect(Object.keys(DocumentTemplateService)).toEqual(['getTemplates']);
    });
  });
});
