/**
 * Frontend Tests for Google Docs Integration
 * Tests the React components and TypeScript services
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GoogleDocsLoader } from '@/components/documents/GoogleDocsLoader';
import { 
  GoogleDocsIntegrationService,
  googleDocsIntegration 
} from '@/services/google-docs-integration';
import { googleFolderSync } from '@/services/google-folder-sync';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console methods to reduce test output noise
const originalConsole = console;
beforeEach(() => {
  console.error = vi.fn();
  console.warn = vi.fn();
  console.log = vi.fn();
});

afterEach(() => {
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.log = originalConsole.log;
  vi.resetAllMocks();
});

describe('GoogleDocsIntegrationService', () => {
  describe('extractDocumentId', () => {
    it('should extract document ID from standard Google Docs URL', () => {
      const url = 'https://docs.google.com/document/d/1abc123def456ghi789/edit';
      const result = GoogleDocsIntegrationService.extractDocumentId(url);
      expect(result).toBe('1abc123def456ghi789');
    });

    it('should extract document ID from view URL', () => {
      const url = 'https://docs.google.com/document/d/2def456ghi789jkl012/view';
      const result = GoogleDocsIntegrationService.extractDocumentId(url);
      expect(result).toBe('2def456ghi789jkl012');
    });

    it('should return document ID if already provided', () => {
      const directId = '3ghi789jkl012mno345pqr678stu901vwx234';
      const result = GoogleDocsIntegrationService.extractDocumentId(directId);
      expect(result).toBe(directId);
    });

    it('should return null for invalid URLs', () => {
      const invalidUrl = 'https://invalid-url.com/document';
      const result = GoogleDocsIntegrationService.extractDocumentId(invalidUrl);
      expect(result).toBeNull();
    });
  });

  describe('getSupportedExportFormats', () => {
    it('should return all supported export formats', () => {
      const formats = GoogleDocsIntegrationService.getSupportedExportFormats();
      
      expect(formats).toHaveLength(4);
      expect(formats[0]).toEqual({
        value: 'text/plain',
        label: 'Plain Text',
        description: 'Simple text format, good for basic processing'
      });
      
      const formatValues = formats.map(f => f.value);
      expect(formatValues).toContain('text/plain');
      expect(formatValues).toContain('text/html');
      expect(formatValues).toContain('application/pdf');
      expect(formatValues).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });
  });

  describe('loadGoogleDoc', () => {
    it('should successfully load a Google Doc', async () => {
      const mockResponse = {
        success: true,
        message: 'Document loaded successfully',
        google_doc_id: '1abc123def456',
        processed_at: '2024-01-15T10:00:00Z'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const request = {
        document_id: '1abc123def456',
        export_format: 'text/plain' as const,
        process_immediately: true
      };

      const result = await googleDocsIntegration.loadGoogleDoc(request);
      
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/n8n-webhook/load-google-doc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer '
        },
        body: JSON.stringify({
          document_id: '1abc123def456',
          export_format: 'text/plain',
          target_folder: 'downloaded_docs',
          process_immediately: true
        })
      });
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const request = {
        document_id: '1abc123def456',
        export_format: 'text/plain' as const
      };

      const result = await googleDocsIntegration.loadGoogleDoc(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('N8N Workflow failed');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const request = {
        document_id: '1abc123def456',
        export_format: 'text/plain' as const
      };

      const result = await googleDocsIntegration.loadGoogleDoc(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('loadMultipleGoogleDocs', () => {
    it('should process multiple documents in batches', async () => {
      const mockResponse = {
        success: true,
        message: 'Document loaded successfully',
        processed_at: '2024-01-15T10:00:00Z'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const requests = [
        { document_id: '1abc123', export_format: 'text/plain' as const },
        { document_id: '2def456', export_format: 'text/html' as const },
        { document_id: '3ghi789', export_format: 'application/pdf' as const },
        { document_id: '4jkl012', export_format: 'text/plain' as const }
      ];

      const results = await googleDocsIntegration.loadMultipleGoogleDocs(requests);
      
      expect(results).toHaveLength(4);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('validateDocumentAccess', () => {
    it('should validate document ID format', async () => {
      const result = await googleDocsIntegration.validateDocumentAccess('invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid document ID format');
    });

    it('should accept valid document ID format', async () => {
      const validId = '1abc123def456ghi789jkl012mno345pqr678stu901vwx';
      const result = await googleDocsIntegration.validateDocumentAccess(validId);
      expect(result.valid).toBe(true);
    });
  });
});

describe('GoogleDocsLoader Component', () => {
  const mockOnDocumentLoaded = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    mockOnDocumentLoaded.mockClear();
    mockOnError.mockClear();
  });

  it('should render the component with all form elements', () => {
    render(
      <GoogleDocsLoader 
        onDocumentLoaded={mockOnDocumentLoaded}
        onError={mockOnError}
      />
    );

    expect(screen.getByText('Load Google Docs')).toBeInTheDocument();
    expect(screen.getByLabelText(/Google Docs URL or Document ID/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Export Format/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Process with AI immediately/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Load Document/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Batch Load/ })).toBeInTheDocument();
  });

  it('should validate URL input and show errors', async () => {
    render(<GoogleDocsLoader onError={mockOnError} />);

    const loadButton = screen.getByRole('button', { name: /Load Document/ });
    
    // Try to load without entering URL
    fireEvent.click(loadButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Please enter a Google Docs URL/)).toBeInTheDocument();
    });
  });

  it('should handle successful document loading', async () => {
    const mockResponse = {
      success: true,
      message: 'Document loaded successfully',
      google_doc_id: '1abc123def456',
      processed_at: '2024-01-15T10:00:00Z'
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    render(<GoogleDocsLoader onDocumentLoaded={mockOnDocumentLoaded} />);

    const urlInput = screen.getByLabelText(/Google Docs URL or Document ID/);
    const loadButton = screen.getByRole('button', { name: /Load Document/ });

    fireEvent.change(urlInput, { 
      target: { value: 'https://docs.google.com/document/d/1abc123def456/edit' } 
    });
    
    fireEvent.click(loadButton);

    await waitFor(() => {
      expect(mockOnDocumentLoaded).toHaveBeenCalledWith(mockResponse);
    });
  });

  it('should show loading state during processing', async () => {
    let resolvePromise: (value: any) => void;
    const loadingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValueOnce(loadingPromise);

    render(<GoogleDocsLoader />);

    const urlInput = screen.getByLabelText(/Google Docs URL or Document ID/);
    const loadButton = screen.getByRole('button', { name: /Load Document/ });

    fireEvent.change(urlInput, { 
      target: { value: '1abc123def456' } 
    });
    
    fireEvent.click(loadButton);

    // Check loading state
    await waitFor(() => {
      expect(screen.getByText(/Loading.../)).toBeInTheDocument();
    });

    // Resolve the promise to complete loading
    resolvePromise!({
      ok: true,
      json: async () => ({ success: true, google_doc_id: '1abc123def456' })
    });
  });

  it('should handle export format selection', () => {
    render(<GoogleDocsLoader />);

    const formatSelect = screen.getByLabelText(/Export Format/);
    expect(formatSelect).toBeInTheDocument();
    
    // The default value should be text/plain
    expect(formatSelect).toHaveValue('text/plain');
  });

  it('should toggle AI processing option', () => {
    render(<GoogleDocsLoader />);

    const processCheckbox = screen.getByLabelText(/Process with AI immediately/);
    expect(processCheckbox).toBeChecked(); // Should be checked by default

    fireEvent.click(processCheckbox);
    expect(processCheckbox).not.toBeChecked();
  });
});

describe('Integration Test Scenarios', () => {
  it('should handle complete workflow from URL to processing', async () => {
    const mockValidationResponse = { valid: true };
    const mockLoadResponse = {
      success: true,
      message: 'Document loaded successfully',
      google_doc_id: '1abc123def456',
      document_data: { content: 'Test document content' },
      processed_at: '2024-01-15T10:00:00Z'
    };

    // Mock the validation call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidationResponse
    });

    // Mock the load document call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockLoadResponse
    });

    const url = 'https://docs.google.com/document/d/1abc123def456/edit';
    const documentId = GoogleDocsIntegrationService.extractDocumentId(url);
    
    expect(documentId).toBe('1abc123def456');

    // Validate document access
    const validation = await googleDocsIntegration.validateDocumentAccess(documentId!);
    expect(validation.valid).toBe(true);

    // Load the document
    const result = await googleDocsIntegration.loadGoogleDoc({
      document_id: documentId!,
      export_format: 'text/plain',
      process_immediately: true
    });

    expect(result.success).toBe(true);
    expect(result.google_doc_id).toBe('1abc123def456');
    expect(result.document_data).toBeDefined();
  });

  it('should handle error scenarios gracefully', async () => {
    // Test invalid URL
    const invalidUrl = 'https://invalid-url.com';
    const documentId = GoogleDocsIntegrationService.extractDocumentId(invalidUrl);
    expect(documentId).toBeNull();

    // Test network error
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    
    const result = await googleDocsIntegration.loadGoogleDoc({
      document_id: '1abc123def456',
      export_format: 'text/plain'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });
});