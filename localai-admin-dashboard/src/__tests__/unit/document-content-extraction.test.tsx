/**
 * Integration test for document content extraction during smart upload
 * Tests that document content is properly extracted and stored, not just placeholder text
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentUploadPage } from '@/features/documents/components/DocumentUploadPage';
import { createWrapper } from '../test-utils';

// Mock dependencies
vi.mock('@/lib/document-processor-enhanced', () => ({
  DocumentProcessorEnhanced: vi.fn().mockImplementation(() => ({
    evaluateDocumentType: vi.fn().mockResolvedValue({
      document_info: {
        filename: 'test-invoice.pdf',
        file_size: 51200,
        mime_type: 'application/pdf'
      },
      type_evaluation: {
        primary_type: 'invoice',
        confidence: 0.92,
        detection_method: 'ai_analysis'
      },
      template_suggestions: [
        {
          template_id: 1,
          template_name: 'Invoice Information Extractor',
          confidence: 0.89,
          reasoning: 'Document contains invoice-like structure'
        }
      ]
    }),
    processDocumentWithDocling: vi.fn().mockResolvedValue({
      content: 'INVOICE #12345\n\nDate: 2024-01-15\nVendor: Acme Corp\nTotal Amount: $1,250.00\n\nLine Items:\n- Product A: $500.00\n- Product B: $750.00',
      metadata: {
        title: 'Invoice 12345',
        author: 'Acme Corp',
        page_count: 1,
        creation_date: '2024-01-15'
      },
      structure: {
        headings: ['INVOICE', 'Line Items'],
        tables: [
          {
            headers: ['Item', 'Amount'],
            rows: [
              ['Product A', '$500.00'],
              ['Product B', '$750.00']
            ]
          }
        ],
        images: []
      }
    })
  }))
}));

vi.mock('@/services/unified-document-service', () => ({
  UnifiedDocumentService: {
    createDocument: vi.fn().mockResolvedValue({
      id: 'test-doc-123',
      filename: 'test-invoice.pdf',
      file_size: 51200,
      mime_type: 'application/pdf',
      status: 'uploaded',
      upload_source: 'smart_upload',
      created_at: new Date().toISOString(),
      created_by: 'test-user-id'
    }),
    updateDocumentStatus: vi.fn().mockResolvedValue({}),
    finalizeDocument: vi.fn().mockResolvedValue({
      id: 'test-doc-123',
      content_text: 'INVOICE #12345\n\nDate: 2024-01-15\nVendor: Acme Corp\nTotal Amount: $1,250.00\n\nLine Items:\n- Product A: $500.00\n- Product B: $750.00',
      metadata: {
        document_type: 'invoice',
        title: 'Invoice 12345',
        author: 'Acme Corp',
        page_count: 1
      }
    })
  }
}));

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useRouter: () => ({
    navigate: mockNavigate
  })
}));

describe('Document Content Extraction Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract actual document content during upload, not placeholder text', async () => {
    const user = userEvent.setup();

    render(<DocumentUploadPage />, { wrapper: createWrapper() });

    // Create a test PDF file
    const testFile = new File(
      ['%PDF-1.4 mock invoice content'],
      'test-invoice.pdf',
      { type: 'application/pdf' }
    );

    // Find and trigger file input
    const fileInput = screen.getByLabelText(/upload document/i, { selector: 'input[type="file"]' });
    await user.upload(fileInput, testFile);

    // Wait for processing to complete
    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith({
          to: '/documents/test-doc-123'
        });
      },
      { timeout: 10000 }
    );

    // Import the mocked services to verify calls
    const { UnifiedDocumentService } = await import('@/services/unified-document-service');
    const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');

    // Verify the complete flow was executed
    expect(UnifiedDocumentService.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        file: testFile,
        uploadSource: 'smart_upload'
      })
    );

    // CRITICAL: Verify processDocumentWithDocling was called
    const processorInstance = new DocumentProcessorEnhanced();
    expect(processorInstance.processDocumentWithDocling).toHaveBeenCalledWith(testFile);

    // CRITICAL: Verify finalizeDocument was called with REAL content
    expect(UnifiedDocumentService.finalizeDocument).toHaveBeenCalledWith(
      'test-doc-123',
      expect.objectContaining({
        content_text: expect.stringContaining('INVOICE #12345'),
        content_text: expect.not.stringContaining('Sample document content for'),
      })
    );

    // Verify the content is NOT placeholder text
    const finalizeCall = (UnifiedDocumentService.finalizeDocument as any).mock.calls[0];
    const savedContent = finalizeCall[1].content_text;

    expect(savedContent).toBeDefined();
    expect(savedContent).not.toContain('Sample document content for');
    expect(savedContent).toContain('INVOICE #12345');
    expect(savedContent).toContain('Acme Corp');
    expect(savedContent).toContain('$1,250.00');
  });

  it('should extract content even when no templates are suggested', async () => {
    const user = userEvent.setup();

    // Override mock to return no template suggestions
    const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');
    const processorInstance = new DocumentProcessorEnhanced();

    (processorInstance.evaluateDocumentType as any).mockResolvedValueOnce({
      document_info: {
        filename: 'generic-doc.pdf',
        file_size: 25600,
        mime_type: 'application/pdf'
      },
      type_evaluation: {
        primary_type: 'other',
        confidence: 0.45,
        detection_method: 'fallback'
      },
      template_suggestions: [] // No templates
    });

    render(<DocumentUploadPage />, { wrapper: createWrapper() });

    const testFile = new File(['test content'], 'generic-doc.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByLabelText(/upload document/i, { selector: 'input[type="file"]' });
    await user.upload(fileInput, testFile);

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalled();
      },
      { timeout: 10000 }
    );

    // Even without template suggestions, content should be extracted
    expect(processorInstance.processDocumentWithDocling).toHaveBeenCalledWith(testFile);

    const { UnifiedDocumentService } = await import('@/services/unified-document-service');
    expect(UnifiedDocumentService.finalizeDocument).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        content_text: expect.any(String)
      })
    );
  });

  it('should handle content extraction errors gracefully', async () => {
    const user = userEvent.setup();

    // Mock extraction failure
    const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');
    const processorInstance = new DocumentProcessorEnhanced();

    (processorInstance.processDocumentWithDocling as any).mockRejectedValueOnce(
      new Error('Docling processing failed: unsupported format')
    );

    render(<DocumentUploadPage />, { wrapper: createWrapper() });

    const testFile = new File(['corrupt data'], 'corrupt.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByLabelText(/upload document/i, { selector: 'input[type="file"]' });
    await user.upload(fileInput, testFile);

    // Should show error message
    await waitFor(
      () => {
        expect(screen.getByText(/processing failed/i)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Document should be marked as failed
    const { UnifiedDocumentService } = await import('@/services/unified-document-service');
    expect(UnifiedDocumentService.markDocumentFailed).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Docling processing failed')
    );
  });
});
