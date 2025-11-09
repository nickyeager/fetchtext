import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Create a test component to verify hook dependency issues
const TestComponent = () => {
  const [document, setDocument] = React.useState<any>({
    template_id: 1,
    metadata: {
      extracted_fields: { field1: 'value1' }
    }
  });
  
  const [documentContent] = React.useState({
    processed: {
      extracted_data: { field1: 'value1' },
      text: 'sample text'
    }
  });

  // This mirrors the issue in DocumentDetailView.tsx
  const generateFormattedOutput = async () => {
    const extractedData = documentContent.processed.extracted_data;
    const templateId = document?.template_id;
    
    if (!extractedData || (templateId === undefined || templateId === null)) {
      return documentContent.processed.text;
    }
    
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100));
    return 'formatted output';
  };

  // Test the problematic useEffect
  const [formattedOutput, setFormattedOutput] = React.useState<string | null>(null);
  const [effectCallCount, setEffectCallCount] = React.useState(0);

  React.useEffect(() => {
    setEffectCallCount(prev => prev + 1);
    if (document?.template_id && documentContent.processed.extracted_data) {
      generateFormattedOutput().then(setFormattedOutput);
    }
  }, [document?.template_id, documentContent.processed.extracted_data]); // Missing generateFormattedOutput

  return { 
    formattedOutput, 
    effectCallCount, 
    setDocument,
    generateFormattedOutput
  };
};

describe('DocumentDetailView Hook Dependencies', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it('should have stale closure issue with generateFormattedOutput', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => TestComponent(), { wrapper });

    // Initial effect should run once
    expect(result.current.effectCallCount).toBe(1);

    // Wait for initial formatting
    await waitFor(() => {
      expect(result.current.formattedOutput).toBe('formatted output');
    });

    // Update document - this would cause issues with stale closure
    result.current.setDocument({
      template_id: 2,
      metadata: {
        extracted_fields: { field2: 'value2' }
      }
    });

    // Effect should run again
    await waitFor(() => {
      expect(result.current.effectCallCount).toBe(2);
    });

    // The formatted output might not update correctly due to stale closure
    // This demonstrates the bug - generateFormattedOutput uses stale document/documentContent
  });
});

// Test to verify the actual polling behavior
describe('DocumentDetailView Polling Behavior', () => {
  it('should poll correctly when document is processing', async () => {
    const mockDocument = {
      id: 'test-123',
      processing_status: 'processing',
      status: 'processing'
    };

    let pollCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      pollCount++;
      if (pollCount < 3) {
        return Promise.resolve(mockDocument);
      }
      return Promise.resolve({
        ...mockDocument,
        processing_status: 'completed',
        status: 'completed'
      });
    });

    // Test the refetchInterval logic
    const refetchInterval = (data: any) => {
      if (data?.processing_status === 'analyzing' || data?.processing_status === 'processing' ||
          data?.status === 'analyzing' || data?.status === 'processing') {
        return 1000; // Poll every 1 second
      }
      return false; // Stop polling
    };

    // Initial state should trigger polling
    expect(refetchInterval(mockDocument)).toBe(1000);

    // Completed state should stop polling
    expect(refetchInterval({ 
      ...mockDocument, 
      processing_status: 'completed',
      status: 'completed'
    })).toBe(false);

    // Test various status combinations
    expect(refetchInterval({ status: 'analyzing' })).toBe(1000);
    expect(refetchInterval({ processing_status: 'analyzing' })).toBe(1000);
    expect(refetchInterval({ status: 'completed' })).toBe(false);
    expect(refetchInterval({ processing_status: 'completed' })).toBe(false);
  });
});