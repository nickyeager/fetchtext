import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentTemplateService } from '../template-service';

// Mock supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

describe('DocumentTemplateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTemplateById', () => {
    it('should successfully fetch and transform template', async () => {
      // Mock user response
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123' } },
      });

      // Mock database response
      const mockDbTemplate = {
        id: 2,
        name: 'Business Invoice Template',
        description: 'Extract invoice data',
        template_content: 'Invoice for {{vendor_name}}',
        category: 'business',
        variables: [
          {
            id: 'vendor_name',
            name: 'vendor_name',
            type: 'text',
            description: 'Vendor name',
            extraction_hints: ['vendor', 'company'],
          },
        ],
        tags: ['invoice', 'business'],
        usage_count: 15,
        is_public: true,
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockDbTemplate, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      // Call the method
      const result = await DocumentTemplateService.getTemplateById('2');

      // Verify it returns expected structure
      expect(result).toEqual(
        expect.objectContaining({
          id: 2,
          name: 'Business Invoice Template',
          description: 'Extract invoice data',
          template_content: 'Invoice for {{vendor_name}}',
          category: 'business',
          smart_variables: expect.arrayContaining([
            expect.objectContaining({
              id: 'vendor_name',
              name: 'vendor_name',
              type: 'text',
            }),
          ]),
          extraction_rules: [],
          generation_settings: {},
          tags: ['invoice', 'business'],
          usage_count: 15,
          rating: 4.2,
        })
      );
    });

    it('should throw error when template not found', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123' } },
      });

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'Not found' } 
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      await expect(DocumentTemplateService.getTemplateById('999'))
        .rejects.toThrow('Template not found');
    });
  });
});
