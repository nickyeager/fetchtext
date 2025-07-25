import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentProcessor } from '@/features/documents/components/DocumentProcessor';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } }
      })
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ data: null, error: null })
    })
  }
}));

// Mock fetch for N8N webhook
global.fetch = vi.fn();

const mockTemplate = {
  id: 1,
  uuid: 'test-uuid',
  name: 'Simple Test Template',
  description: 'A simple test template',
  template_content: 'Hello {{name}}, your age is {{age}}.',
  smart_variables: [
    {
      id: 'name',
      name: 'name',
      type: 'text' as const,
      description: 'Person name',
      extraction_hints: []
    }
  ],
  category: 'test'
};

describe('DocumentProcessor Debug Tests', () => {
  const mockOnBack = vi.fn();
  const mockOnGenerationComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch to always fail (falling back to mock data)
    (global.fetch as any).mockRejectedValue(new Error('Network error'));
  });

  it('should handle text file upload step by step', async () => {
    render(
      <DocumentProcessor
        selectedTemplate={mockTemplate}
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );

    // Test file creation
    const file = new File(['Hello world'], 'test.txt', { type: 'text/plain' });
    expect(file.name).toBe('test.txt');
    expect(file.type).toBe('text/plain');

    // Test what methods are available on File
    console.log('File methods:', Object.getOwnPropertyNames(file));
    console.log('File prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(file)));
    console.log('Has text method:', typeof file.text === 'function');
    console.log('FileReader available:', typeof FileReader !== 'undefined');

    // Try reading the file differently if text() doesn't exist
    if (typeof file.text === 'function') {
      const fileText = await file.text();
      expect(fileText).toBe('Hello world');
    } else if (typeof FileReader !== 'undefined') {
      // Test FileReader directly
      const text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });
      console.log('FileReader result:', text);
      expect(text).toBe('Hello world');
    } else {
      console.log('Neither File.text() nor FileReader available in test environment');
    }

    // Get file input and trigger upload
    const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
    expect(fileInput).toBeInTheDocument();

    // Simulate file upload
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for upload to be processed
    await waitFor(() => {
      // Should see at least the upload step completed
      const processingPipeline = screen.getByText('Processing Pipeline');
      expect(processingPipeline).toBeInTheDocument();
    }, { timeout: 2000 });

    // Debug what's happening with the processing steps
    console.log('DOM after file upload:', screen.debug());

    // Check for extracted text section specifically  
    await waitFor(() => {
      // Look for the "Extracted Text" card which should appear after text extraction
      const extractedTextCard = screen.queryByText('Extracted Text');
      if (extractedTextCard) {
        console.log('✓ Found Extracted Text card');
        expect(extractedTextCard).toBeInTheDocument();
      } else {
        // If not found, let's check the processing status and DOM
        const statusElement = screen.getByText(/Extract Text Content|AI Data Extraction|Ready to start/);
        console.log('Current processing status:', statusElement.textContent);
        
        // Check if text extraction completed but card isn't showing
        console.log('Looking for extracted text in DOM...');
        screen.debug();
        
        // At minimum, we should have progressed beyond "Ready to start"
        expect(screen.queryByText('Ready to start')).not.toBeInTheDocument();
      }
    }, { timeout: 5000 });
  });
});
