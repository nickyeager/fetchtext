/**
 * Unified Document Service Timeout and Recovery Tests
 * Tests for template extraction timeout handling and stuck document recovery
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnifiedDocumentService, DocumentStatus } from '../unified-document-service';

// Mock external dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn()
            }))
          }))
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      }))
    })),
    storage: {
      from: vi.fn(() => ({
        download: vi.fn(),
        upload: vi.fn()
      }))
    }
  }
}));

vi.mock('./smart-template-service', () => ({
  smartTemplateService: {
    getTemplate: vi.fn()
  }
}));

vi.mock('@/lib/document-processor-enhanced', () => ({
  DocumentProcessorEnhanced: vi.fn().mockImplementation(() => ({
    processDocumentWithTemplate: vi.fn(),
    evaluateDocumentType: vi.fn()
  }))
}));

vi.mock('@/lib/supabase-auth-utils', () => ({
  requireAuthentication: vi.fn().mockResolvedValue({ id: 'user-123' })
}));

describe('UnifiedDocumentService Timeout Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Template Extraction Timeout', () => {
    it('should handle template extraction timeout with fallback', async () => {
      const { supabase } = await import('@/lib/supabase');
      const { smartTemplateService } = await import('./smart-template-service');
      const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');

      // Mock document retrieval
      const mockDocument = {
        id: 'doc-1',
        name: 'test.pdf',
        file_path: 'user/test.pdf',
        file_type: 'application/pdf',
        metadata: { template_id: 1 }
      };

      // @ts-ignore
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockDocument, error: null })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ 
                data: { ...mockDocument, processing_status: 'completed' }, 
                error: null 
              })
            })
          })
        })
      });

      // Mock file download
      const mockFileData = new Blob(['test file content'], { type: 'application/pdf' });
      // @ts-ignore
      supabase.storage.from.mockReturnValue({
        download: vi.fn().mockResolvedValue({ data: mockFileData, error: null })
      });

      // Mock template
      const mockTemplate = {
        id: 1,
        name: 'Test Template',
        smart_variables: [{ id: 'field1', name: 'field1', type: 'text' }]
      };
      // @ts-ignore
      smartTemplateService.getTemplate.mockResolvedValue(mockTemplate);

      // Mock DocumentProcessor to timeout
      const mockProcessor = {
        processDocumentWithTemplate: vi.fn().mockImplementation(() => 
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Template extraction timeout')), 6000);
          })
        )
      };
      // @ts-ignore
      DocumentProcessorEnhanced.mockImplementation(() => mockProcessor);

      // Spy on the private method by accessing it through reflection
      const triggerTemplateExtraction = UnifiedDocumentService['triggerTemplateExtraction'];
      
      // Execute the timeout scenario
      const extractionPromise = triggerTemplateExtraction('doc-1');
      
      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(6000);
      
      await extractionPromise;

      // Verify fallback processing was called
      expect(supabase.from).toHaveBeenCalledWith('documents');
      
      // Check that finalizeDocument was called with timeout metadata
      const updateCalls = supabase.from().update.mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);
      
      const lastUpdateCall = updateCalls[updateCalls.length - 1][0];
      expect(lastUpdateCall.processing_status).toBe('completed');
      expect(lastUpdateCall.metadata).toMatchObject({
        extraction_timeout: true,
        fallback_processing: true
      });
    });

    it('should handle network timeout during template extraction', async () => {
      const { supabase } = await import('@/lib/supabase');
      const { smartTemplateService } = await import('./smart-template-service');
      const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');

      // Mock document retrieval
      const mockDocument = {
        id: 'doc-2',
        name: 'test.pdf',
        file_path: 'user/test.pdf',
        file_type: 'application/pdf',
        metadata: { template_id: 2 }
      };

      // @ts-ignore
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockDocument, error: null })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ 
                data: { ...mockDocument, processing_status: 'failed' }, 
                error: null 
              })
            })
          })
        })
      });

      // Mock file download
      const mockFileData = new Blob(['test file content'], { type: 'application/pdf' });
      // @ts-ignore
      supabase.storage.from.mockReturnValue({
        download: vi.fn().mockResolvedValue({ data: mockFileData, error: null })
      });

      // Mock template
      const mockTemplate = {
        id: 2,
        name: 'Test Template',
        smart_variables: [{ id: 'field1', name: 'field1', type: 'text' }]
      };
      // @ts-ignore
      smartTemplateService.getTemplate.mockResolvedValue(mockTemplate);

      // Mock DocumentProcessor to fail with network error
      const mockProcessor = {
        processDocumentWithTemplate: vi.fn().mockRejectedValue(new Error('Failed to fetch'))
      };
      // @ts-ignore
      DocumentProcessorEnhanced.mockImplementation(() => mockProcessor);

      // Execute the error scenario
      const triggerTemplateExtraction = UnifiedDocumentService['triggerTemplateExtraction'];
      await triggerTemplateExtraction('doc-2');

      // Verify document was marked as failed
      const updateCalls = supabase.from().update.mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);
      
      const lastUpdateCall = updateCalls[updateCalls.length - 1][0];
      expect(lastUpdateCall.processing_status).toBe('failed');
      expect(lastUpdateCall.metadata.error_message).toContain('Template extraction failed');
    });

    it('should handle missing template gracefully', async () => {
      const { supabase } = await import('@/lib/supabase');
      const { smartTemplateService } = await import('./smart-template-service');

      // Mock document retrieval
      const mockDocument = {
        id: 'doc-3',
        name: 'test.pdf',
        file_path: 'user/test.pdf',
        file_type: 'application/pdf',
        metadata: { template_id: 999 } // Non-existent template
      };

      // @ts-ignore
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockDocument, error: null })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ 
                data: { ...mockDocument, processing_status: 'failed' }, 
                error: null 
              })
            })
          })
        })
      });

      // Mock file download
      const mockFileData = new Blob(['test file content'], { type: 'application/pdf' });
      // @ts-ignore
      supabase.storage.from.mockReturnValue({
        download: vi.fn().mockResolvedValue({ data: mockFileData, error: null })
      });

      // Mock template not found
      // @ts-ignore
      smartTemplateService.getTemplate.mockResolvedValue(null);

      // Execute the missing template scenario
      const triggerTemplateExtraction = UnifiedDocumentService['triggerTemplateExtraction'];
      await triggerTemplateExtraction('doc-3');

      // Verify document was marked as failed with appropriate error
      const updateCalls = supabase.from().update.mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);
      
      const lastUpdateCall = updateCalls[updateCalls.length - 1][0];
      expect(lastUpdateCall.processing_status).toBe('failed');
      expect(lastUpdateCall.metadata.error_message).toContain('Template not found: 999');
    });
  });

  describe('AI Analysis Timeout Handling', () => {
    it('should handle AI analysis timeout with fallback', async () => {
      const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');
      const { supabase } = await import('@/lib/supabase');

      // Mock document retrieval
      const mockDocument = {
        id: 'doc-4',
        name: 'test.pdf',
        file_path: 'user/test.pdf',
        file_type: 'application/pdf',
        metadata: {}
      };

      // @ts-ignore
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockDocument, error: null })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ 
                data: { ...mockDocument, processing_status: 'processing' }, 
                error: null 
              })
            })
          })
        })
      });

      // Mock file download
      const mockFileData = new Blob(['test file content'], { type: 'application/pdf' });
      // @ts-ignore
      supabase.storage.from.mockReturnValue({
        download: vi.fn().mockResolvedValue({ data: mockFileData, error: null })
      });

      // Mock DocumentProcessor to timeout
      const mockProcessor = {
        evaluateDocumentType: vi.fn().mockRejectedValue(new Error('network timeout'))
      };
      // @ts-ignore
      DocumentProcessorEnhanced.mockImplementation(() => mockProcessor);

      // Execute the AI analysis timeout scenario
      const triggerAIAnalysis = UnifiedDocumentService['triggerAIAnalysis'];
      await triggerAIAnalysis('doc-4');

      // Verify fallback processing was applied
      const updateCalls = supabase.from().update.mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);
      
      const lastUpdateCall = updateCalls[updateCalls.length - 1][0];
      expect(lastUpdateCall.processing_status).toBe('processing');
      expect(lastUpdateCall.metadata).toMatchObject({
        fallback_analysis: true,
        backend_unavailable: true
      });
    });
  });

  describe('Force Retry Analysis', () => {
    it('should reset document status for retry', async () => {
      const { supabase } = await import('@/lib/supabase');

      // @ts-ignore
      supabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ 
                data: { id: 'doc-5', processing_status: 'analyzing' }, 
                error: null 
              })
            })
          })
        })
      });

      await UnifiedDocumentService.forceRetryAnalysis('doc-5');

      // Verify update was called with retry metadata
      expect(supabase.from).toHaveBeenCalledWith('documents');
      expect(supabase.from().update).toHaveBeenCalledWith({
        processing_status: 'analyzing',
        metadata: expect.objectContaining({
          retry_attempt: true,
          retry_timestamp: expect.any(String)
        })
      });
    });

    it('should handle retry analysis errors', async () => {
      const { supabase } = await import('@/lib/supabase');

      // @ts-ignore
      supabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockRejectedValue(new Error('Database error'))
            })
          })
        })
      });

      await expect(UnifiedDocumentService.forceRetryAnalysis('doc-6')).rejects.toThrow('Database error');
    });
  });

  describe('Document Status Updates', () => {
    it('should validate status values', async () => {
      const { supabase } = await import('@/lib/supabase');

      // @ts-ignore
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { metadata: {} }, 
              error: null 
            })
          })
        })
      });

      // Test invalid status
      await expect(
        UnifiedDocumentService.updateDocumentStatus('doc-7', {
          // @ts-ignore - Intentionally testing invalid status
          status: 'invalid_status'
        })
      ).rejects.toThrow("Invalid status 'invalid_status'");
    });

    it('should add appropriate timestamps for status transitions', async () => {
      const { supabase } = await import('@/lib/supabase');

      // @ts-ignore
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { metadata: {} }, 
              error: null 
            })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ 
                data: { id: 'doc-8', processing_status: 'processing' }, 
                error: null 
              })
            })
          })
        })
      });

      await UnifiedDocumentService.updateDocumentStatus('doc-8', {
        status: DocumentStatus.PROCESSING
      });

      // Verify timestamps were added
      const updateCall = supabase.from().update.mock.calls[0][0];
      expect(updateCall.metadata).toMatchObject({
        processing_started_at: expect.any(String)
      });
    });
  });
});