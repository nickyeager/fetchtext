import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TemplateMatchingService } from '@/lib/template-matching-service';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
  },
}));

describe('TemplateMatchingService', () => {
  let templateMatcher: TemplateMatchingService;

  beforeEach(() => {
    vi.clearAllMocks();
    templateMatcher = new TemplateMatchingService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('findBestTemplate', () => {
    it('should find the best matching template based on document structure', async () => {
      const mockDocument = {
        content: 'Executive Summary\n\nFinancial Overview\n\nConclusions',
        metadata: {
          title: 'Q4 Business Report',
          format: 'pdf',
          pages: 15
        },
        structure: {
          headings: [
            { level: 1, text: 'Executive Summary' },
            { level: 1, text: 'Financial Overview' },
            { level: 1, text: 'Conclusions' }
          ],
          tables: [
            { position: 200, rows: 5, columns: 4 }
          ],
          images: []
        }
      };

      const mockTemplates = [
        {
          id: 'template-business-report',
          name: 'Business Report Template',
          templateType: 'n8n' as const,
          configuration: {
            structure: ['Executive Summary', 'Financial Analysis', 'Conclusions'],
            expectedSections: 3,
            hasFinancialData: true
          }
        },
        {
          id: 'template-meeting-notes',
          name: 'Meeting Notes Template',
          templateType: 'n8n' as const,
          configuration: {
            structure: ['Attendees', 'Agenda', 'Action Items'],
            expectedSections: 3,
            hasFinancialData: false
          }
        }
      ];

      vi.spyOn(templateMatcher, 'loadTemplates').mockResolvedValue(mockTemplates);

      const result = await templateMatcher.findBestTemplate(mockDocument);

      expect(result.templateId).toBe('template-business-report');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.matchReasons).toContain('structure similarity');
      expect(result.matchReasons).toContain('financial content detected');
    });

    it('should return null when no suitable template is found', async () => {
      const mockDocument = {
        content: 'Random content with no clear structure',
        metadata: { title: 'Unknown Document', format: 'pdf', pages: 1 },
        structure: { headings: [], tables: [], images: [] }
      };

      const mockTemplates = [
        {
          id: 'template-business-report',
          name: 'Business Report Template',
          templateType: 'n8n' as const,
          configuration: {
            structure: ['Executive Summary', 'Financial Analysis'],
            expectedSections: 2,
            hasFinancialData: true
          }
        }
      ];

      vi.spyOn(templateMatcher, 'loadTemplates').mockResolvedValue(mockTemplates);

      const result = await templateMatcher.findBestTemplate(mockDocument);

      expect(result).toBeNull();
    });

    it('should handle multiple high-scoring templates and return the best one', async () => {
      const mockDocument = {
        content: 'Meeting Agenda\n\nAttendees\n\nAction Items',
        metadata: { title: 'Team Meeting Notes', format: 'docx', pages: 2 },
        structure: {
          headings: [
            { level: 1, text: 'Meeting Agenda' },
            { level: 1, text: 'Attendees' },
            { level: 1, text: 'Action Items' }
          ],
          tables: [],
          images: []
        }
      };

      const mockTemplates = [
        {
          id: 'template-meeting-notes-v1',
          name: 'Meeting Notes Template V1',
          templateType: 'n8n' as const,
          configuration: {
            structure: ['Agenda', 'Attendees', 'Action Items'],
            expectedSections: 3,
            keywords: ['meeting', 'agenda', 'attendees']
          }
        },
        {
          id: 'template-meeting-notes-v2',
          name: 'Meeting Notes Template V2',
          templateType: 'flowise' as const,
          configuration: {
            structure: ['Meeting Agenda', 'Attendees', 'Action Items'],
            expectedSections: 3,
            keywords: ['meeting', 'agenda', 'attendees', 'action']
          }
        }
      ];

      vi.spyOn(templateMatcher, 'loadTemplates').mockResolvedValue(mockTemplates);

      const result = await templateMatcher.findBestTemplate(mockDocument);

      expect(result.templateId).toBe('template-meeting-notes-v2'); // Should prefer exact heading matches
      expect(result.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('calculateSimilarity', () => {
    it('should calculate high similarity for matching document structures', async () => {
      const mockDocument = {
        content: 'Introduction\n\nMethodology\n\nResults\n\nConclusion',
        metadata: { title: 'Research Report', format: 'pdf', pages: 10 },
        structure: {
          headings: [
            { level: 1, text: 'Introduction' },
            { level: 1, text: 'Methodology' },
            { level: 1, text: 'Results' },
            { level: 1, text: 'Conclusion' }
          ],
          tables: [{ position: 300, rows: 10, columns: 3 }],
          images: []
        }
      };

      const mockTemplate = {
        id: 'template-research-report',
        name: 'Research Report Template',
        templateType: 'n8n' as const,
        configuration: {
          structure: ['Introduction', 'Methodology', 'Results', 'Conclusion'],
          expectedSections: 4,
          hasDataTables: true,
          keywords: ['research', 'methodology', 'results']
        }
      };

      const similarity = await templateMatcher.calculateSimilarity(mockDocument, mockTemplate);

      expect(similarity).toBeGreaterThan(0.9);
    });

    it('should calculate low similarity for non-matching structures', async () => {
      const mockDocument = {
        content: 'Shopping List\n\nGroceries\n\nHousehold Items',
        metadata: { title: 'Shopping List', format: 'txt', pages: 1 },
        structure: {
          headings: [
            { level: 1, text: 'Shopping List' },
            { level: 2, text: 'Groceries' },
            { level: 2, text: 'Household Items' }
          ],
          tables: [],
          images: []
        }
      };

      const mockTemplate = {
        id: 'template-business-report',
        name: 'Business Report Template',
        templateType: 'n8n' as const,
        configuration: {
          structure: ['Executive Summary', 'Financial Analysis', 'Recommendations'],
          expectedSections: 3,
          hasFinancialData: true,
          keywords: ['business', 'financial', 'analysis']
        }
      };

      const similarity = await templateMatcher.calculateSimilarity(mockDocument, mockTemplate);

      expect(similarity).toBeLessThan(0.3);
    });

    it('should weight different matching factors appropriately', async () => {
      const mockDocument = {
        content: 'Project Overview\n\nBudget Analysis\n\nTimeline',
        metadata: { title: 'Project Plan', format: 'docx', pages: 5 },
        structure: {
          headings: [
            { level: 1, text: 'Project Overview' },
            { level: 1, text: 'Budget Analysis' },
            { level: 1, text: 'Timeline' }
          ],
          tables: [{ position: 100, rows: 5, columns: 3 }],
          images: [{ position: 200, alt: 'Gantt Chart' }]
        }
      };

      const mockTemplate = {
        id: 'template-project-plan',
        name: 'Project Plan Template',
        templateType: 'n8n' as const,
        configuration: {
          structure: ['Overview', 'Budget', 'Timeline'],
          expectedSections: 3,
          hasBudgetData: true,
          hasTimeline: true,
          keywords: ['project', 'budget', 'timeline']
        }
      };

      const similarity = await templateMatcher.calculateSimilarity(mockDocument, mockTemplate);

      // Should have good similarity due to:
      // - Similar section structure (partial match)
      // - Budget/financial content
      // - Timeline content
      // - Keyword matches
      expect(similarity).toBeGreaterThan(0.7);
      expect(similarity).toBeLessThan(0.95); // Not perfect due to heading text differences
    });
  });

  describe('getTemplateRecommendations', () => {
    it('should return ranked list of template recommendations', async () => {
      const mockDocument = {
        content: 'Product Roadmap\n\nFeature Overview\n\nTimeline\n\nResources',
        metadata: { title: 'Q1 Product Roadmap', format: 'pptx', pages: 8 },
        structure: {
          headings: [
            { level: 1, text: 'Product Roadmap' },
            { level: 1, text: 'Feature Overview' },
            { level: 1, text: 'Timeline' },
            { level: 1, text: 'Resources' }
          ],
          tables: [],
          images: [{ position: 50, alt: 'Product Timeline Chart' }]
        }
      };

      const mockTemplates = [
        {
          id: 'template-product-roadmap',
          name: 'Product Roadmap Template',
          templateType: 'n8n' as const,
          configuration: {
            structure: ['Roadmap', 'Features', 'Timeline', 'Resources'],
            keywords: ['product', 'roadmap', 'features', 'timeline']
          }
        },
        {
          id: 'template-project-plan',
          name: 'Project Plan Template',
          templateType: 'flowise' as const,
          configuration: {
            structure: ['Overview', 'Timeline', 'Resources'],
            keywords: ['project', 'timeline', 'resources']
          }
        },
        {
          id: 'template-meeting-notes',
          name: 'Meeting Notes Template',
          templateType: 'n8n' as const,
          configuration: {
            structure: ['Agenda', 'Notes', 'Action Items'],
            keywords: ['meeting', 'notes', 'agenda']
          }
        }
      ];

      vi.spyOn(templateMatcher, 'loadTemplates').mockResolvedValue(mockTemplates);

      const recommendations = await templateMatcher.getTemplateRecommendations(mockDocument, 3);

      expect(recommendations).toHaveLength(3);
      expect(recommendations[0].templateId).toBe('template-product-roadmap');
      expect(recommendations[0].confidence).toBeGreaterThan(recommendations[1].confidence);
      expect(recommendations[1].confidence).toBeGreaterThan(recommendations[2].confidence);
      
      // All recommendations should have confidence > 0
      recommendations.forEach(rec => {
        expect(rec.confidence).toBeGreaterThan(0);
        expect(rec.matchReasons).toBeDefined();
        expect(rec.matchReasons.length).toBeGreaterThan(0);
      });
    });

    it('should limit results to minimum confidence threshold', async () => {
      const mockDocument = {
        content: 'Random unstructured content',
        metadata: { title: 'Unknown', format: 'txt', pages: 1 },
        structure: { headings: [], tables: [], images: [] }
      };

      const mockTemplates = [
        {
          id: 'template-structured',
          name: 'Structured Template',
          templateType: 'n8n' as const,
          configuration: {
            structure: ['Section 1', 'Section 2'],
            keywords: ['specific', 'keywords']
          }
        }
      ];

      vi.spyOn(templateMatcher, 'loadTemplates').mockResolvedValue(mockTemplates);

      const recommendations = await templateMatcher.getTemplateRecommendations(mockDocument, 5, 0.5);

      // Should return empty array if no templates meet minimum confidence
      expect(recommendations).toHaveLength(0);
    });
  });

  describe('analyzeDocumentType', () => {
    it('should correctly identify document types based on content and structure', async () => {
      const businessReportDoc = {
        content: 'Executive Summary\n\nRevenue increased by 25%\n\nRecommendations',
        metadata: { title: 'Q4 Business Report', format: 'pdf', pages: 10 },
        structure: {
          headings: [
            { level: 1, text: 'Executive Summary' },
            { level: 1, text: 'Financial Performance' },
            { level: 1, text: 'Recommendations' }
          ],
          tables: [{ position: 100, rows: 10, columns: 5 }],
          images: []
        }
      };

      const analysis = await templateMatcher.analyzeDocumentType(businessReportDoc);

      expect(analysis.primaryType).toBe('business-report');
      expect(analysis.confidence).toBeGreaterThan(0.8);
      expect(analysis.characteristics).toContain('financial-data');
      expect(analysis.characteristics).toContain('executive-summary');
      expect(analysis.suggestedTemplateTypes).toContain('n8n');
    });

    it('should handle documents with mixed characteristics', async () => {
      const mixedDoc = {
        content: 'Meeting Notes\n\nProject Timeline\n\nBudget Overview',
        metadata: { title: 'Project Meeting', format: 'docx', pages: 3 },
        structure: {
          headings: [
            { level: 1, text: 'Meeting Notes' },
            { level: 1, text: 'Project Timeline' },
            { level: 1, text: 'Budget Overview' }
          ],
          tables: [{ position: 150, rows: 5, columns: 3 }],
          images: []
        }
      };

      const analysis = await templateMatcher.analyzeDocumentType(mixedDoc);

      expect(analysis.primaryType).toBeDefined();
      expect(analysis.secondaryTypes).toBeDefined();
      expect(analysis.characteristics.length).toBeGreaterThan(1);
    });
  });
});
