/**
 * ProcessedDocumentsService Detail Tests
 * 
 * Tests for the enhanced document detail service methods:
 * - getDocumentProcessingHistory
 * - getDocumentQualityMetrics
 * - searchDocuments
 * - Enhanced error handling and edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProcessedDocumentsService } from '../processed-documents-service';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          order: vi.fn(() => ({
            limit: vi.fn(),
          })),
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(),
              })),
            })),
          })),
        })),
        or: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),
  },
}));

const mockUser = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
  },
};

const mockDocument = {
  id: 'doc-123',
  uuid: 'uuid-123',
  name: 'test-document.pdf',
  file_path: '/uploads/test-document.pdf',
  file_type: 'application/pdf',
  file_size: 1024000,
  content_text: 'Test document content',
  metadata: {
    template_id: 1,
    template_name: 'Invoice Template',
    processing_status: 'completed',
    processing_method: 'template_guided',
    extracted_fields: {
      invoice_number: {
        value: 'INV-2024-001',
        confidence: 0.95,
      },
      total_amount: {
        value: '$1,250.00',
        confidence: 0.88,
      },
    },
    ai_enhancement_enabled: true,
    ai_classification: {
      primary_category: 'invoice',
      confidence_score: 0.92,
    },
    quality_assessment: {
      completeness_score: 0.85,
      readability_score: 0.78,
      structure_score: 0.90,
      overall_quality: 'high',
      insights: ['Document has clear structure'],
    },
    ai_processing_time: 2.45,
  },
  uploaded_by: 'user-123',
  created_at: '2024-01-15T10:30:00Z',
  updated_at: '2024-01-15T10:30:00Z',
};

describe('ProcessedDocumentsService - Document Detail Methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: mockUser,
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getDocumentProcessingHistory', () => {
    it('returns processing history for a valid document', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: mockDocument,
              error: null,
            }),
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await ProcessedDocumentsService.getDocumentProcessingHistory('doc-123');

      expect(result).toBeDefined();
      expect(result?.document.id).toBe('doc-123');
      expect(result?.processingSteps).toHaveLength(4); // Upload, extraction, template, AI
      
      const steps = result?.processingSteps || [];
      expect(steps[0].step).toBe('Document Upload');
      expect(steps[1].step).toBe('Content Extraction');
      expect(steps[2].step).toBe('Template Processing');
      expect(steps[3].step).toBe('AI Enhancement');
    });

    it('handles documents without AI enhancement', async () => {
      const documentWithoutAI = {
        ...mockDocument,
        metadata: {
          ...mockDocument.metadata,
          ai_enhancement_enabled: false,
          ai_classification: undefined,
        },
      };

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: documentWithoutAI,
              error: null,
            }),
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await ProcessedDocumentsService.getDocumentProcessingHistory('doc-123');

      expect(result?.processingSteps).toHaveLength(3); // No AI step
      expect(result?.processingSteps.find(step => step.step === 'AI Enhancement')).toBeUndefined();
    });

    it('returns null for non-existent document', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await ProcessedDocumentsService.getDocumentProcessingHistory('non-existent');

      expect(result).toBeNull();
    });

    it('includes correct processing details', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: mockDocument,
              error: null,
            }),
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await ProcessedDocumentsService.getDocumentProcessingHistory('doc-123');

      const templateStep = result?.processingSteps.find(step => step.step === 'Template Processing');
      expect(templateStep?.details).toEqual({
        template: 'Invoice Template',
        fields_extracted: 2,
        method: 'template_guided',
      });

      const aiStep = result?.processingSteps.find(step => step.step === 'AI Enhancement');
      expect(aiStep?.details).toEqual({
        classification: 'invoice',
        confidence: 0.92,
        processing_time: 2.45,
      });
    });
  });

  describe('getDocumentQualityMetrics', () => {
    it('calculates quality metrics correctly', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: mockDocument,
              error: null,
            }),
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await ProcessedDocumentsService.getDocumentQualityMetrics('doc-123');

      expect(result).toBeDefined();
      expect(result?.extraction_quality).toBeCloseTo(0.915); // (1.0 * 1 + 0.7 * 1) / 2
      expect(result?.confidence_distribution).toEqual({
        high: 1, // invoice_number (0.95)
        medium: 1, // total_amount (0.88)
        low: 0,
      });
      expect(result?.ai_quality_score).toBe(0.9); // 'high' quality
    });

    it('handles documents without extracted fields', async () => {
      const documentWithoutFields = {
        ...mockDocument,
        metadata: {
          ...mockDocument.metadata,
          extracted_fields: undefined,
        },
      };

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: documentWithoutFields,
              error: null,
            }),
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await ProcessedDocumentsService.getDocumentQualityMetrics('doc-123');

      expect(result?.extraction_quality).toBe(0);
      expect(result?.confidence_distribution).toEqual({
        high: 0,
        medium: 0,
        low: 0,
      });
    });

    it('provides quality recommendations', async () => {
      const documentWithLowConfidence = {
        ...mockDocument,
        metadata: {
          ...mockDocument.metadata,
          extracted_fields: {
            field1: { value: 'test', confidence: 0.5 },
            field2: { value: 'test', confidence: 0.4 },
            field3: { value: 'test', confidence: 0.3 },
          },
        },
      };

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: documentWithLowConfidence,
              error: null,
            }),
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await ProcessedDocumentsService.getDocumentQualityMetrics('doc-123');

      expect(result?.recommendations).toContain('Consider re-processing with a different template for better accuracy');
      expect(result?.recommendations).toContain('Review extracted fields manually for accuracy');
    });

    it('maps AI quality scores correctly', async () => {
      const testCases = [
        { quality: 'high', expected: 0.9 },
        { quality: 'medium', expected: 0.7 },
        { quality: 'low', expected: 0.4 },
      ];

      for (const testCase of testCases) {
        const documentWithQuality = {
          ...mockDocument,
          metadata: {
            ...mockDocument.metadata,
            quality_assessment: {
              overall_quality: testCase.quality,
            },
          },
        };

        const mockFrom = vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: documentWithQuality,
                error: null,
              }),
            })),
          })),
        }));
        vi.mocked(supabase.from).mockImplementation(mockFrom);

        const result = await ProcessedDocumentsService.getDocumentQualityMetrics('doc-123');
        expect(result?.ai_quality_score).toBe(testCase.expected);
      }
    });

    it('includes AI insights in recommendations', async () => {
      const documentWithInsights = {
        ...mockDocument,
        metadata: {
          ...mockDocument.metadata,
          quality_assessment: {
            overall_quality: 'medium',
            insights: ['Custom insight 1', 'Custom insight 2'],
          },
        },
      };

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: documentWithInsights,
              error: null,
            }),
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await ProcessedDocumentsService.getDocumentQualityMetrics('doc-123');

      expect(result?.recommendations).toContain('Custom insight 1');
      expect(result?.recommendations).toContain('Custom insight 2');
    });
  });

  describe('searchDocuments', () => {
    const mockSearchResults = [
      mockDocument,
      {
        ...mockDocument,
        id: 'doc-456',
        name: 'another-document.pdf',
        metadata: {
          template_id: 2,
          template_name: 'Report Template',
          processing_method: 'generic',
        },
      },
    ];

    it('searches documents by query', async () => {
      const mockOrder = vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({
          data: mockSearchResults,
          error: null,
        }),
      }));
      const mockOr = vi.fn(() => ({
        order: mockOrder,
      }));
      const mockEq = vi.fn(() => ({
        or: mockOr,
      }));
      const mockSelect = vi.fn(() => ({
        eq: mockEq,
      }));
      const mockFrom = vi.fn(() => ({
        select: mockSelect,
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await ProcessedDocumentsService.searchDocuments('invoice');

      expect(mockOr).toHaveBeenCalledWith('name.ilike.%invoice%,content_text.ilike.%invoice%');
      expect(result).toHaveLength(2);
    });

    it('applies date filters', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: mockSearchResults,
        error: null,
      });
      const mockOrder = vi.fn(() => ({
        limit: mockLimit,
      }));
      const mockLte = vi.fn(() => ({
        order: mockOrder,
      }));
      const mockGte = vi.fn(() => ({
        lte: mockLte,
      }));
      const mockOr = vi.fn(() => ({
        gte: mockGte,
      }));
      const mockEq = vi.fn(() => ({
        or: mockOr,
      }));
      const mockSelect = vi.fn(() => ({
        eq: mockEq,
      }));
      const mockFrom = vi.fn(() => ({
        select: mockSelect,
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      await ProcessedDocumentsService.searchDocuments('test', {
        date_from: '2024-01-01',
        date_to: '2024-01-31',
      });

      expect(mockGte).toHaveBeenCalledWith('created_at', '2024-01-01');
      expect(mockLte).toHaveBeenCalledWith('created_at', '2024-01-31');
    });

    it('filters by template_id', async () => {
      const mockOrder = vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({
          data: mockSearchResults,
          error: null,
        }),
      }));
      const mockOr = vi.fn(() => ({
        order: mockOrder,
      }));
      const mockEq = vi.fn(() => ({
        or: mockOr,
      }));
      const mockSelect = vi.fn(() => ({
        eq: mockEq,
      }));
      const mockFrom = vi.fn(() => ({
        select: mockSelect,
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await ProcessedDocumentsService.searchDocuments('', {
        template_id: 1,
      });

      // Should filter out doc-456 which has template_id: 2
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('doc-123');
    });

    it('filters by processing_method', async () => {
      const mockOrder = vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({
          data: mockSearchResults,
          error: null,
        }),
      }));
      const mockOr = vi.fn(() => ({
        order: mockOrder,
      }));
      const mockEq = vi.fn(() => ({
        or: mockOr,
      }));
      const mockSelect = vi.fn(() => ({
        eq: mockEq,
      }));
      const mockFrom = vi.fn(() => ({
        select: mockSelect,
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await ProcessedDocumentsService.searchDocuments('', {
        processing_method: 'template_guided',
      });

      // Should filter out doc-456 which has processing_method: 'generic'
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('doc-123');
    });

    it('handles empty search query', async () => {
      const mockOrder = vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({
          data: mockSearchResults,
          error: null,
        }),
      }));
      const mockEq = vi.fn(() => ({
        order: mockOrder,
      }));
      const mockSelect = vi.fn(() => ({
        eq: mockEq,
      }));
      const mockFrom = vi.fn(() => ({
        select: mockSelect,
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await ProcessedDocumentsService.searchDocuments('');

      expect(result).toHaveLength(2);
    });

    it('throws error on search failure', async () => {
      const mockOrder = vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Search failed' },
        }),
      }));
      const mockOr = vi.fn(() => ({
        order: mockOrder,
      }));
      const mockEq = vi.fn(() => ({
        or: mockOr,
      }));
      const mockSelect = vi.fn(() => ({
        eq: mockEq,
      }));
      const mockFrom = vi.fn(() => ({
        select: mockSelect,
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      await expect(
        ProcessedDocumentsService.searchDocuments('test')
      ).rejects.toThrow('Failed to search documents: Search failed');
    });
  });

  describe('Error Handling', () => {
    it('throws error when user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      await expect(
        ProcessedDocumentsService.getDocumentProcessingHistory('doc-123')
      ).rejects.toThrow('User not authenticated');
    });

    it('handles database errors gracefully', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      await expect(
        ProcessedDocumentsService.getDocumentProcessingHistory('doc-123')
      ).rejects.toThrow('Failed to fetch processed document: Database error');
    });
  });

  describe('Edge Cases', () => {
    it('handles documents with minimal metadata', async () => {
      const minimalDocument = {
        ...mockDocument,
        content_text: null,
        metadata: {},
      };

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: minimalDocument,
              error: null,
            }),
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const history = await ProcessedDocumentsService.getDocumentProcessingHistory('doc-123');
      expect(history?.processingSteps).toHaveLength(1); // Only upload step

      const metrics = await ProcessedDocumentsService.getDocumentQualityMetrics('doc-123');
      expect(metrics?.extraction_quality).toBe(0);
      expect(metrics?.recommendations).toEqual([]);
    });

    it('handles malformed metadata gracefully', async () => {
      const malformedDocument = {
        ...mockDocument,
        metadata: {
          extracted_fields: 'invalid', // Should be object
          quality_assessment: null,
        },
      };

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: malformedDocument,
              error: null,
            }),
          })),
        })),
      }));
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const metrics = await ProcessedDocumentsService.getDocumentQualityMetrics('doc-123');
      expect(metrics?.extraction_quality).toBe(0);
    });
  });
});