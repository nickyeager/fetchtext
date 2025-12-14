import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { DocumentDetailView } from '@/features/documents/components/DocumentDetailView';

/**
 * Integration test for extracted fields display
 *
 * Tests that extracted fields are displayed as individual inputs,
 * not as JSON blobs, regardless of the data source structure.
 */
describe('Extracted Fields Display Integration Test', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
  });

  // Helper to create router wrapper
  const createRouterWrapper = (documentId: string) => {
    const rootRoute = createRootRoute();
    const documentRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/documents/$documentId',
      component: () => <DocumentDetailView documentId={documentId} />
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([documentRoute]),
      history: createMemoryHistory({ initialEntries: [`/documents/${documentId}`] })
    });
    return router;
  };

  it('should display extracted fields as individual inputs, not JSON blobs', async () => {
    // Create test document data with known structure
    const mockDocument = {
      id: '123',
      name: 'Test Contract Document',
      processing_status: 'completed',
      extracted_fields: {},
      metadata: {
        extracted_data: {
          extracted_values: {
            company_name: {
              value: 'Acme Corp',
              confidence: 0.95,
              source_text: 'AI extracted',
              location: 'llm_intelligent'
            },
            contract_number: {
              value: 'CNT-12345',
              confidence: 0.88,
              source_text: 'AI extracted',
              location: 'llm_intelligent'
            },
            amount: {
              value: '$50,000',
              confidence: 0.92,
              source_text: 'AI extracted',
              location: 'llm_intelligent'
            }
          },
          confidence_scores: {
            company_name: 0.95,
            contract_number: 0.88,
            amount: 0.92
          }
        }
      },
      created_at: new Date().toISOString(),
      file_type: 'application/pdf',
      file_size: 12345,
      content_text: 'Sample contract content'
    };

    // Mock the API response
    const { UnifiedDocumentService } = await import('@/services/unified-document-service');
    vi.spyOn(UnifiedDocumentService, 'getDocumentById').mockResolvedValue(mockDocument as any);

    // Create router and render
    const router = createRouterWrapper('123');
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Test Contract Document')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify extracted fields section exists
    await waitFor(() => {
      const pageText = document.body.textContent || '';

      // Check that field names appear (not as JSON keys)
      expect(pageText).toContain('company_name');
      expect(pageText).toContain('contract_number');
      expect(pageText).toContain('amount');

      // Verify field values are displayed correctly
      expect(pageText).toContain('Acme Corp');
      expect(pageText).toContain('CNT-12345');
      expect(pageText).toContain('$50,000');

      // CRITICAL: Verify NOT displaying as JSON blob
      // If fields are JSON blobs, we'd see the stringified structure
      expect(pageText).not.toContain('{"value":"Acme Corp"');
      expect(pageText).not.toContain('"confidence":0.95');
      expect(pageText).not.toContain('"source_text"');
    }, { timeout: 3000 });
  });

  it('should handle different metadata storage structures', async () => {
    // Test with data in metadata.extraction_result.extracted_values
    const mockDocumentAltStructure = {
      id: '456',
      name: 'Test Invoice',
      processing_status: 'completed',
      extracted_fields: {},
      metadata: {
        extraction_result: {
          extracted_values: {
            vendor_name: { value: 'ABC Supply Co', confidence: 0.9, source_text: 'AI extracted' },
            invoice_date: { value: '2025-12-01', confidence: 0.85, source_text: 'AI extracted' },
            total_amount: { value: '$1,234.56', confidence: 0.92, source_text: 'AI extracted' }
          },
          confidence_scores: {
            vendor_name: 0.9,
            invoice_date: 0.85,
            total_amount: 0.92
          }
        }
      },
      created_at: new Date().toISOString(),
      file_type: 'application/pdf',
      file_size: 12345,
      content_text: 'Sample invoice content'
    };

    const { UnifiedDocumentService } = await import('@/services/unified-document-service');
    vi.spyOn(UnifiedDocumentService, 'getDocumentById').mockResolvedValue(mockDocumentAltStructure as any);

    const router = createRouterWrapper('456');
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Invoice')).toBeInTheDocument();
    }, { timeout: 3000 });

    await waitFor(() => {
      const pageText = document.body.textContent || '';

      // Should still find and display fields correctly
      expect(pageText).toContain('vendor_name');
      expect(pageText).toContain('ABC Supply Co');
      expect(pageText).toContain('$1,234.56');

      // Should NOT be JSON blobs
      expect(pageText).not.toContain('{"value":"ABC Supply Co"');
    }, { timeout: 3000 });
  });

  it('should handle JSON-stringified field data', async () => {
    // Test with double-stringified data (Supabase storage issue)
    const mockDocumentStringified = {
      id: '789',
      name: 'Test Receipt',
      processing_status: 'completed',
      extracted_fields: {},
      metadata: {
        extracted_data: {
          // Simulate JSON-stringified extracted_values
          extracted_values: JSON.stringify({
            merchant_name: {
              value: 'Coffee Shop LLC',
              confidence: 0.88,
              source_text: 'AI extracted'
            },
            purchase_date: {
              value: '2025-12-13',
              confidence: 0.90,
              source_text: 'AI extracted'
            }
          })
        }
      },
      created_at: new Date().toISOString(),
      file_type: 'image/png',
      file_size: 54321,
      content_text: 'Sample receipt content'
    };

    const { UnifiedDocumentService } = await import('@/services/unified-document-service');
    vi.spyOn(UnifiedDocumentService, 'getDocumentById').mockResolvedValue(mockDocumentStringified as any);

    const router = createRouterWrapper('789');
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Receipt')).toBeInTheDocument();
    }, { timeout: 3000 });

    await waitFor(() => {
      const pageText = document.body.textContent || '';

      // parseExtractedFields should handle the stringified data
      expect(pageText).toContain('merchant_name');
      expect(pageText).toContain('Coffee Shop LLC');
      expect(pageText).toContain('2025-12-13');

      // Should NOT show the stringified JSON structure
      expect(pageText).not.toContain('{"value":"Coffee Shop LLC"');
    }, { timeout: 3000 });
  });

  it('should display confidence scores as percentages', async () => {
    const mockDocument = {
      id: '999',
      name: 'Test Document with Confidence',
      processing_status: 'completed',
      extracted_fields: {},
      metadata: {
        extracted_data: {
          extracted_values: {
            test_field: {
              value: 'Test Value',
              confidence: 0.95,
              source_text: 'AI extracted'
            }
          },
          confidence_scores: {
            test_field: 0.95
          }
        }
      },
      created_at: new Date().toISOString(),
      file_type: 'application/pdf',
      file_size: 12345,
      content_text: 'Test content'
    };

    const { UnifiedDocumentService } = await import('@/services/unified-document-service');
    vi.spyOn(UnifiedDocumentService, 'getDocumentById').mockResolvedValue(mockDocument as any);

    const router = createRouterWrapper('999');
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Document with Confidence')).toBeInTheDocument();
    }, { timeout: 3000 });

    await waitFor(() => {
      const pageText = document.body.textContent || '';

      // Check for percentage display (95%)
      expect(pageText).toMatch(/95%/);
      expect(pageText).toContain('Test Value');
    }, { timeout: 3000 });
  });
});
