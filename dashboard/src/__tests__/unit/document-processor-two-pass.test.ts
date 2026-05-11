import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Document Processor Two-Pass Support', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should include use_two_pass parameter when enabled', async () => {
    // Track what URL params are sent
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        extracted_data: {
          extraction_method: 'two_pass_intelligent',
          extracted_values: {}
        }
      })
    });
    global.fetch = mockFetch;

    // Import the module (it will use our mocked fetch)
    const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');
    const processor = new DocumentProcessorEnhanced();

    // Call extraction with useTwoPass option
    await processor.extractWithText(
      'Test content',
      [{ name: 'test_field', type: 'text', description: 'Test field', extraction_hints: ['test'], id: 'test_field' }],
      { useTwoPass: true }
    );

    // Verify the URL includes use_two_pass=true
    expect(mockFetch).toHaveBeenCalled();
    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain('use_two_pass=true');
  });

  it('should not include use_two_pass when not specified', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        extracted_data: {
          extraction_method: 'intelligent',
          extracted_values: {}
        }
      })
    });
    global.fetch = mockFetch;

    const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');
    const processor = new DocumentProcessorEnhanced();

    // Call without useTwoPass
    await processor.extractWithText(
      'Test content',
      [{ name: 'test_field', type: 'text', description: 'Test field', extraction_hints: ['test'], id: 'test_field' }]
    );

    // Verify use_two_pass is NOT in URL
    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).not.toContain('use_two_pass');
  });

  it('should default useTwoPass to false when options is undefined', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        extracted_data: {
          extraction_method: 'intelligent',
          extracted_values: {}
        }
      })
    });
    global.fetch = mockFetch;

    const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');
    const processor = new DocumentProcessorEnhanced();

    // Call with no options parameter
    await processor.extractWithText(
      'Test content',
      [{ name: 'test_field', type: 'text', description: 'Test field', extraction_hints: ['test'], id: 'test_field' }]
    );

    // Verify use_two_pass is NOT in URL
    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).not.toContain('use_two_pass');
  });

  it('should allow combining useTwoPass with other options', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        extracted_data: {
          extraction_method: 'two_pass_intelligent',
          extracted_values: {}
        }
      })
    });
    global.fetch = mockFetch;

    const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');
    const processor = new DocumentProcessorEnhanced();

    // Call with both useTwoPass and confidenceThreshold
    await processor.extractWithText(
      'Test content',
      [{ name: 'test_field', type: 'text', description: 'Test field', extraction_hints: ['test'], id: 'test_field' }],
      { useTwoPass: true, confidenceThreshold: 0.8 }
    );

    // Verify both parameters are in URL
    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain('use_two_pass=true');
    expect(callUrl).toContain('confidence_threshold=0.8');
  });
});
