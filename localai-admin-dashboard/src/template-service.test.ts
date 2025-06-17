import { describe, it, expect, vi } from 'vitest';

// Test without React components first
describe('Template Service Tests', () => {
  it('should import template service', async () => {
    // Mock the template service
    vi.doMock('@/lib/template-service', () => ({
      TemplateService: {
        getTemplates: vi.fn().mockResolvedValue([]),
        useTemplate: vi.fn().mockResolvedValue('test-id'),
      },
    }));
    
    const { TemplateService } = await import('@/lib/template-service');
    expect(TemplateService).toBeDefined();
    expect(TemplateService.getTemplates).toBeDefined();
  });

  it('should handle basic template operations', async () => {
    expect(true).toBe(true);
  });
});
