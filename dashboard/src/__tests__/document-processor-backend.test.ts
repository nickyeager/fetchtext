import { describe, it, expect, beforeAll } from 'vitest';
import { DocumentProcessorEnhanced } from '@/lib/document-processor-enhanced';

describe('DocumentProcessorEnhanced Backend Integration', () => {
  let processor: DocumentProcessorEnhanced;

  beforeAll(() => {
    processor = new DocumentProcessorEnhanced();
  });

  it('should detect backend service availability', async () => {
    const status = await processor.getBackendStatus();
    console.log('Backend status:', status);
    
    expect(status.status).toBe('available');
    expect(status.docling_available).toBe(true);
  });

  it('should process document with real backend when available', async () => {
    // Create a test file
    const testContent = 'Test document content';
    const testFile = new File([testContent], 'test.txt', { type: 'text/plain' });

    // Process with real backend
    const result = await processor.processDocumentWithDocling(testFile);
    
    console.log('Processing result:', result);
    
    // Verify we got real data (not mock data)
    expect(result.content).toBeDefined();
    expect(result.metadata).toBeDefined();
    expect(result.structure).toBeDefined();
    
    // If this is mock data, the content will be "Test document content for test.txt..."
    // Real backend data should be different
    expect(result.content).not.toMatch(/^Test document content for/);
  });

  it('should detect when backend is unavailable', async () => {
    // Create a processor with wrong URL to test fallback
    const processorWithWrongUrl = new (class extends DocumentProcessorEnhanced {
      protected baseUrl = 'http://localhost:9999/documents'; // Wrong port
    })();

    const status = await processorWithWrongUrl.getBackendStatus();
    expect(status.status).toBe('unavailable');
    expect(status.docling_available).toBe(false);
  });

  it('should handle unsupported file formats', async () => {
    const unsupportedFile = new File(['test'], 'test.xyz', { type: 'application/unknown' });
    
    await expect(processor.processDocumentWithDocling(unsupportedFile))
      .rejects.toThrow('Unsupported file format');
  });

  it('should process template extraction with real backend', async () => {
    const testFile = new File(['Invoice content'], 'invoice.txt', { type: 'text/plain' });
    
    // Use the Invoice Processor template we seeded
    const mockTemplate = {
      id: 1,
      name: 'Invoice Processor',
      description: 'Extract key information from invoices',
      template_content: '# Invoice\n**Vendor:** {vendor_name}',
      smart_variables: [
        {
          id: 'vendor_name',
          name: 'vendor_name',
          type: 'text' as const,
          description: 'Name of the vendor',
          extraction_hints: ['vendor', 'supplier', 'from']
        }
      ],
      category: 'Finance',
      tags: ['invoice', 'finance']
    };

    const result = await processor.processDocumentWithTemplate(testFile, mockTemplate);
    
    console.log('Template extraction result:', result);
    
    expect(result.extractedFields).toBeDefined();
    expect(result.template).toEqual(mockTemplate);
    expect(result.content).toBeDefined();
  });
});