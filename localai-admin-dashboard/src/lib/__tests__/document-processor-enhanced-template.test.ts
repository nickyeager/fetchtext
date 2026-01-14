import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentProcessorEnhanced } from '../document-processor-enhanced';
import { API_ENDPOINTS } from '@/lib/api-config';

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

describe('DocumentProcessorEnhanced Template Integration', () => {
  let documentProcessor: DocumentProcessorEnhanced;

  beforeEach(() => {
    vi.clearAllMocks();
    documentProcessor = new DocumentProcessorEnhanced();
  });

  describe('processDocumentWithTemplate', () => {
    it('should process document with template and return extracted fields', async () => {
      const mockFile = new File(['invoice content'], 'invoice.pdf', { type: 'application/pdf' });
      
      const mockBackendResponse = {
        content: {
          text: 'Invoice from Acme Corp for $1,500.00 dated 2024-01-15',
          layout_info: {
            headings: [
              { level: 1, text: 'Invoice', position: 0 }
            ]
          }
        },
        metadata: {
          title: 'Invoice Document',
          pages: 1
        },
        extracted_fields: {
          vendor_name: {
            value: 'Acme Corp',
            confidence: 0.95,
            source_text: 'Invoice from Acme Corp',
            location: { page: 1, position: 50 }
          },
          total_amount: {
            value: '$1,500.00',
            confidence: 0.92,
            source_text: 'for $1,500.00',
            location: { page: 1, position: 150 }
          },
          invoice_date: {
            value: '2024-01-15',
            confidence: 0.88,
            source_text: 'dated 2024-01-15',
            location: { page: 1, position: 200 }
          }
        }
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBackendResponse,
      } as Response);

      const result = await documentProcessor.processDocumentWithTemplate(mockFile, mockTemplate);

      // Verify the API call includes template information
      expect(fetch).toHaveBeenCalledWith(
        `${API_ENDPOINTS.documentsUpload}`,
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );

      // Verify the result structure
      expect(result).toEqual({
        content: 'Invoice from Acme Corp for $1,500.00 dated 2024-01-15',
        metadata: expect.objectContaining({
          title: 'Invoice Document',
          format: 'PDF',
          pages: 1,
        }),
        structure: expect.objectContaining({
          headings: [
            { level: 1, text: 'Invoice', position: 0 }
          ],
        }),
        extractedFields: {
          vendor_name: {
            value: 'Acme Corp',
            confidence: 0.95,
            sourceText: 'Invoice from Acme Corp',
            location: { page: 1, position: 50 }
          },
          total_amount: {
            value: '$1,500.00',
            confidence: 0.92,
            sourceText: 'for $1,500.00',
            location: { page: 1, position: 150 }
          },
          invoice_date: {
            value: '2024-01-15',
            confidence: 0.88,
            sourceText: 'dated 2024-01-15',
            location: { page: 1, position: 200 }
          }
        },
        template: mockTemplate,
      });
    });

    it('should fall back to mock data when backend is unavailable', async () => {
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await documentProcessor.processDocumentWithTemplate(mockFile, mockTemplate);

      // Should return mock data with template fields
      expect(result).toBeDefined();
      expect(result.template).toEqual(mockTemplate);
      expect(result.extractedFields).toBeDefined();
      
      // Should have extracted fields for each template variable
      mockTemplate.smart_variables.forEach(variable => {
        expect(result.extractedFields[variable.name]).toBeDefined();
        expect(result.extractedFields[variable.name].value).toBeDefined();
        expect(result.extractedFields[variable.name].confidence).toBeGreaterThan(0);
      });
    });

    it('should generate realistic mock values based on field types and hints', async () => {
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      
      // Force backend unavailable to test mock generation
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await documentProcessor.processDocumentWithTemplate(mockFile, mockTemplate);

      // Check vendor_name field (should be a company name)
      const vendorName = result.extractedFields.vendor_name.value;
      expect(typeof vendorName).toBe('string');
      expect(vendorName.length).toBeGreaterThan(0);
      
      // Check total_amount field (should be currency format)
      const totalAmount = result.extractedFields.total_amount.value;
      expect(typeof totalAmount).toBe('string');
      expect(totalAmount).toMatch(/^\$\d+\.\d{2}$/);
      
      // Check invoice_date field (should be date format)
      const invoiceDate = result.extractedFields.invoice_date.value;
      expect(typeof invoiceDate).toBe('string');
      expect(invoiceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should reject unsupported file formats', async () => {
      const unsupportedFile = new File(['content'], 'test.xyz', { type: 'application/unsupported' });

      await expect(documentProcessor.processDocumentWithTemplate(unsupportedFile, mockTemplate))
        .rejects.toThrow('Unsupported file format: application/unsupported');
    });

    it('should handle backend errors gracefully', async () => {
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Template processing failed' }),
      } as Response);

      // Should fall back to mock data instead of throwing
      const result = await documentProcessor.processDocumentWithTemplate(mockFile, mockTemplate);
      
      expect(result).toBeDefined();
      expect(result.template).toEqual(mockTemplate);
      expect(result.extractedFields).toBeDefined();
    });
  });

  describe('mock value generation', () => {
    it('should generate company names for vendor fields', async () => {
      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const vendorTemplate = {
        ...mockTemplate,
        smart_variables: [{
          id: 'company',
          name: 'company',
          type: 'text' as const,
          description: 'Company name',
          extraction_hints: ['vendor', 'company'],
          default_value: '',
        }]
      };

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
      
      const result = await documentProcessor.processDocumentWithTemplate(mockFile, vendorTemplate);
      const companyValue = result.extractedFields.company.value;
      
      expect(typeof companyValue).toBe('string');
      expect(['Acme Corp', 'TechFlow Inc', 'Global Solutions Ltd', 'InnovateTech']).toContain(companyValue);
    });

    it('should generate email addresses for contact fields', async () => {
      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const emailTemplate = {
        ...mockTemplate,
        smart_variables: [{
          id: 'email',
          name: 'email',
          type: 'text' as const,
          description: 'Email address',
          extraction_hints: ['email', 'contact'],
          default_value: '',
        }]
      };

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
      
      const result = await documentProcessor.processDocumentWithTemplate(mockFile, emailTemplate);
      const emailValue = result.extractedFields.email.value;
      
      expect(typeof emailValue).toBe('string');
      expect(emailValue).toMatch(/^[^@]+@[^@]+\.[^@]+$/); // Basic email format
    });
  });
});