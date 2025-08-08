import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentProcessorEnhanced } from '../document-processor-enhanced';

// Mock fetch globally
global.fetch = vi.fn();

const mockTemplate = {
  id: 2,
  name: 'Business Invoice Template',
  description: 'Extract invoice data including amounts, dates, and vendor information',
  template_content: 'Invoice for {{vendor_name}} - Amount: {{total_amount}} - Date: {{invoice_date}}',
  smart_variables: [
    {
      id: 'vendor_name',
      name: 'vendor_name',
      type: 'text' as const,
      description: 'Name of the vendor or company issuing the invoice',
      extraction_hints: ['vendor', 'company', 'from'],
      default_value: '',
    },
    {
      id: 'total_amount',
      name: 'total_amount',
      type: 'currency' as const,
      description: 'Total amount due on the invoice',
      extraction_hints: ['total', 'amount', 'due', '$'],
      default_value: '',
    },
    {
      id: 'invoice_date',
      name: 'invoice_date',
      type: 'date' as const,
      description: 'Date when the invoice was issued',
      extraction_hints: ['date', 'issued', 'invoice date'],
      default_value: '',
    },
  ],
  category: 'business',
  tags: ['invoice', 'business', 'finance'],
};

describe('DocumentProcessorEnhanced Progressive Extraction', () => {
  let documentProcessor: DocumentProcessorEnhanced;

  beforeEach(() => {
    vi.clearAllMocks();
    documentProcessor = new DocumentProcessorEnhanced();
  });

  describe('processDocumentWithTemplateProgressive', () => {
    it('should yield progressive updates for each field', async () => {
      const mockFile = new File(['invoice content'], 'invoice.pdf', { type: 'application/pdf' });
      
      // Force offline mode to test mock behavior
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const progressiveGenerator = documentProcessor.processDocumentWithTemplateProgressive(mockFile, mockTemplate);
      const updates: any[] = [];

      // Collect all progress updates
      for await (const update of progressiveGenerator) {
        updates.push(update);
      }

      // Should have multiple progress updates
      expect(updates.length).toBeGreaterThan(1);

      // First update should have all fields in pending state
      const firstUpdate = updates[0];
      expect(firstUpdate.isComplete).toBe(false);
      expect(firstUpdate.template).toEqual(mockTemplate);
      
      mockTemplate.smart_variables.forEach(variable => {
        expect(firstUpdate.fieldProgress[variable.name]).toEqual({
          fieldName: variable.name,
          status: 'pending',
          progress: 0,
        });
      });

      // Should have progress updates for each field
      const fieldStatuses = new Set();
      updates.forEach(update => {
        Object.values(update.fieldProgress).forEach((progress: any) => {
          fieldStatuses.add(progress.status);
        });
      });

      // Should have seen various progress states
      expect(fieldStatuses.has('pending')).toBe(true);
      expect(fieldStatuses.has('extracting')).toBe(true);
      expect(fieldStatuses.has('analyzing')).toBe(true);
      expect(fieldStatuses.has('completed')).toBe(true);
    });

    it('should complete with final template extraction result', async () => {
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      
      // Force offline mode
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const progressiveGenerator = documentProcessor.processDocumentWithTemplateProgressive(mockFile, mockTemplate);
      
      // Consume all progress updates
      const updates = [];
      for await (const update of progressiveGenerator) {
        updates.push(update);
      }

      // Get final result
      const finalResult = await progressiveGenerator.next();
      
      expect(finalResult.done).toBe(true);
      expect(finalResult.value).toBeDefined();
      expect(finalResult.value.template).toEqual(mockTemplate);
      expect(finalResult.value.extractedFields).toBeDefined();
      
      // Should have extracted fields for each template variable
      mockTemplate.smart_variables.forEach(variable => {
        expect(finalResult.value.extractedFields[variable.name]).toBeDefined();
        expect(finalResult.value.extractedFields[variable.name].value).toBeDefined();
        expect(finalResult.value.extractedFields[variable.name].confidence).toBeGreaterThan(0);
      });
    });

    it('should show realistic progress transitions', async () => {
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      
      // Force offline mode
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const progressiveGenerator = documentProcessor.processDocumentWithTemplateProgressive(mockFile, mockTemplate);
      const fieldProgressMap = new Map();

      // Track progress for each field
      for await (const update of progressiveGenerator) {
        Object.entries(update.fieldProgress).forEach(([fieldName, progress]: [string, any]) => {
          if (!fieldProgressMap.has(fieldName)) {
            fieldProgressMap.set(fieldName, []);
          }
          fieldProgressMap.get(fieldName).push({
            status: progress.status,
            progress: progress.progress
          });
        });
      }

      // Check that each field went through proper transitions
      mockTemplate.smart_variables.forEach(variable => {
        const progressHistory = fieldProgressMap.get(variable.name);
        expect(progressHistory).toBeDefined();
        expect(progressHistory.length).toBeGreaterThan(1);
        
        // Should start with pending
        expect(progressHistory[0].status).toBe('pending');
        expect(progressHistory[0].progress).toBe(0);
        
        // Should end with completed
        const lastStatus = progressHistory[progressHistory.length - 1];
        expect(lastStatus.status).toBe('completed');
        expect(lastStatus.progress).toBe(100);
        
        // Progress should be non-decreasing
        for (let i = 1; i < progressHistory.length; i++) {
          expect(progressHistory[i].progress).toBeGreaterThanOrEqual(progressHistory[i - 1].progress);
        }
      });
    });

    it('should handle unsupported file formats', async () => {
      const unsupportedFile = new File(['content'], 'test.xyz', { type: 'application/unsupported' });

      const progressiveGenerator = documentProcessor.processDocumentWithTemplateProgressive(unsupportedFile, mockTemplate);

      await expect(async () => {
        for await (const _ of progressiveGenerator) {
          // Should throw before yielding any results
        }
      }).rejects.toThrow('Unsupported file format: application/unsupported');
    });

    it('should generate appropriate mock values for different field types', async () => {
      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      
      // Force offline mode
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const progressiveGenerator = documentProcessor.processDocumentWithTemplateProgressive(mockFile, mockTemplate);
      
      // Get final result
      let finalUpdate: any = null;
      for await (const update of progressiveGenerator) {
        finalUpdate = update;
      }

      // Check vendor_name field (text)
      const vendorProgress = finalUpdate.fieldProgress.vendor_name;
      expect(vendorProgress.status).toBe('completed');
      expect(vendorProgress.result.value).toBeDefined();
      expect(typeof vendorProgress.result.value).toBe('string');
      
      // Check total_amount field (currency)
      const amountProgress = finalUpdate.fieldProgress.total_amount;
      expect(amountProgress.status).toBe('completed');
      expect(amountProgress.result.value).toMatch(/^\$\d+\.\d{2}$/);
      
      // Check invoice_date field (date)
      const dateProgress = finalUpdate.fieldProgress.invoice_date;
      expect(dateProgress.status).toBe('completed');
      expect(dateProgress.result.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // All should have confidence scores
      [vendorProgress, amountProgress, dateProgress].forEach(progress => {
        expect(progress.result.confidence).toBeGreaterThan(0);
        expect(progress.result.confidence).toBeLessThanOrEqual(1);
        expect(progress.result.sourceText).toBeDefined();
        expect(progress.result.location).toBeDefined();
      });
    });

    it('should provide document structure in all updates', async () => {
      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      
      // Force offline mode
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const progressiveGenerator = documentProcessor.processDocumentWithTemplateProgressive(mockFile, mockTemplate);
      
      for await (const update of progressiveGenerator) {
        // Each update should have complete document structure
        expect(update.content).toBeDefined();
        expect(typeof update.content).toBe('string');
        expect(update.metadata).toBeDefined();
        expect(update.structure).toBeDefined();
        expect(update.structure.headings).toBeDefined();
        expect(Array.isArray(update.structure.headings)).toBe(true);
        expect(update.template).toEqual(mockTemplate);
      }
    });
  });
});