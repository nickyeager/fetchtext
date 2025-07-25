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

const mockTemplate = {
  id: 1,
  uuid: 'test-uuid',
  name: 'Test Template',
  description: 'A test template',
  template_content: 'Hello {{name}}, your age is {{age}}.',
  smart_variables: [
    {
      id: 'name',
      name: 'name',
      type: 'text' as const,
      description: 'Person name',
      extraction_hints: []
    },
    {
      id: 'age', 
      name: 'age',
      type: 'number' as const,
      description: 'Person age',
      extraction_hints: []
    }
  ],
  category: 'test'
};

describe('DocumentProcessor - Complete Integration Tests', () => {
  const mockOnBack = vi.fn();
  const mockOnGenerationComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Successful Workflow', () => {
    beforeEach(() => {
      // Mock successful FileReader
      const mockFileReader = {
        result: '',
        readAsText: vi.fn(function(this: any) {
          setTimeout(() => {
            this.result = 'Hello world, my name is John and I am 25 years old.';
            this.onload && this.onload();
          }, 0);
        }),
        onload: null,
        onerror: null,
      };
      global.FileReader = vi.fn(() => mockFileReader) as any;

      // Mock successful N8N response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: { name: 'John Doe', age: 25 }
        })
      });
    });

    it('should complete the full document processing workflow', async () => {
      render(
        <DocumentProcessor
          selectedTemplate={mockTemplate}
          onGenerationComplete={mockOnGenerationComplete}
          onBack={mockOnBack}
        />
      );

      // 1. Initial state
      expect(screen.getByText('Upload Source Document')).toBeInTheDocument();

      // 2. Upload file
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
      fireEvent.change(fileInput, { target: { files: [file] } });

      // 3. Wait for text extraction
      await waitFor(() => {
        expect(screen.getByText('Extracted Text')).toBeInTheDocument();
      }, { timeout: 2000 });

      // 4. Wait for AI extraction 
      await waitFor(() => {
        expect(screen.getByText('AI Extracted Data')).toBeInTheDocument();
      }, { timeout: 3000 });

      // 5. Verify extracted data
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('25')).toBeInTheDocument();

      // 6. Continue to generation
      fireEvent.click(screen.getByText('Continue to Generation'));

      // 7. Generate document
      await waitFor(() => {
        expect(screen.getByText('Generate Document')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Generate Document'));

      // 8. Verify completion
      await waitFor(() => {
        expect(screen.getByText('Download')).toBeInTheDocument();
      }, { timeout: 2000 });

      expect(mockOnGenerationComplete).toHaveBeenCalledWith(
        expect.stringContaining('Hello John Doe, your age is 25')
      );
    });

    it('should allow manual adjustments to extracted data', async () => {
      render(
        <DocumentProcessor
          selectedTemplate={mockTemplate}
          onGenerationComplete={mockOnGenerationComplete}
          onBack={mockOnBack}
        />
      );

      // Upload and wait for AI extraction
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Modify extracted data
      const nameInput = screen.getByDisplayValue('John Doe');
      fireEvent.change(nameInput, { target: { value: 'Jane Smith' } });

      // Continue and generate
      fireEvent.click(screen.getByText('Continue to Generation'));
      await waitFor(() => {
        fireEvent.click(screen.getByText('Generate Document'));
      });

      // Verify modified data is used
      await waitFor(() => {
        expect(mockOnGenerationComplete).toHaveBeenCalledWith(
          expect.stringContaining('Hello Jane Smith, your age is 25')
        );
      }, { timeout: 2000 });
    });

    it('should allow re-extraction of data', async () => {
      render(
        <DocumentProcessor
          selectedTemplate={mockTemplate}
          onGenerationComplete={mockOnGenerationComplete}
          onBack={mockOnBack}
        />
      );

      // Upload and wait for AI extraction
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Re-extract')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Click re-extract
      fireEvent.click(screen.getByText('Re-extract'));

      // Should re-run AI extraction (fetch called twice)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      }, { timeout: 1000 });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      // Mock FileReader that works
      const mockFileReader = {
        result: '',
        readAsText: vi.fn(function(this: any) {
          setTimeout(() => {
            this.result = 'Test content';
            this.onload && this.onload();
          }, 0);
        }),
        onload: null,
        onerror: null,
      };
      global.FileReader = vi.fn(() => mockFileReader) as any;
    });

    it('should handle N8N webhook failures gracefully', async () => {
      // Mock N8N failure
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      render(
        <DocumentProcessor
          selectedTemplate={mockTemplate}
          onGenerationComplete={mockOnGenerationComplete}
          onBack={mockOnBack}
        />
      );

      // Upload file
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Should still show extracted text
      await waitFor(() => {
        expect(screen.getByText('Extracted Text')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Should fall back to mock data
      await waitFor(() => {
        expect(screen.getByText('AI Extracted Data')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Should show default mock values
      expect(screen.getByDisplayValue(/Sample name/)).toBeInTheDocument();
    });

    it('should handle file reading errors', async () => {
      // Mock FileReader that fails
      const mockFileReader = {
        readAsText: vi.fn(function(this: any) {
          setTimeout(() => {
            this.onerror && this.onerror(new Error('Read failed'));
          }, 0);
        }),
        onload: null,
        onerror: null,
      };
      global.FileReader = vi.fn(() => mockFileReader) as any;

      render(
        <DocumentProcessor
          selectedTemplate={mockTemplate}
          onGenerationComplete={mockOnGenerationComplete}
          onBack={mockOnBack}
        />
      );

      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Should show error state in processing pipeline
      await waitFor(() => {
        // Look for error indicator in the steps
        expect(screen.getByText(/Error: Failed to read file/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('File Type Handling', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { name: 'Test', age: 30 } })
      });
    });

    it('should handle non-text files with placeholder text', async () => {
      const mockFileReader = {
        result: '',
        readAsText: vi.fn(function(this: any) {
          setTimeout(() => {
            this.result = 'placeholder text content';
            this.onload && this.onload();
          }, 0);
        }),
        onload: null,
        onerror: null,
      };
      global.FileReader = vi.fn(() => mockFileReader) as any;

      render(
        <DocumentProcessor
          selectedTemplate={mockTemplate}
          onGenerationComplete={mockOnGenerationComplete}
          onBack={mockOnBack}
        />
      );

      // Upload a PDF file
      const file = new File(['binary content'], 'test.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Should show placeholder text for non-text files
      await waitFor(() => {
        expect(screen.getByText(/Extracted text from test.pdf/)).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Navigation', () => {
    it('should handle back navigation correctly', () => {
      render(
        <DocumentProcessor
          selectedTemplate={mockTemplate}
          onGenerationComplete={mockOnGenerationComplete}
          onBack={mockOnBack}
        />
      );

      fireEvent.click(screen.getByText('← Back to Templates'));
      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });

    it('should allow processing another document after completion', async () => {
      // Mock successful workflow
      const mockFileReader = {
        result: '',
        readAsText: vi.fn(function(this: any) {
          setTimeout(() => {
            this.result = 'test content';
            this.onload && this.onload();
          }, 0);
        }),
        onload: null,
        onerror: null,
      };
      global.FileReader = vi.fn(() => mockFileReader) as any;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { name: 'Test', age: 30 } })
      });

      render(
        <DocumentProcessor
          selectedTemplate={mockTemplate}
          onGenerationComplete={mockOnGenerationComplete}
          onBack={mockOnBack}
        />
      );

      // Complete one workflow
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('AI Extracted Data')).toBeInTheDocument();
      }, { timeout: 3000 });

      fireEvent.click(screen.getByText('Continue to Generation'));
      await waitFor(() => {
        fireEvent.click(screen.getByText('Generate Document'));
      });

      // Wait for completion and click "Process Another"
      await waitFor(() => {
        expect(screen.getByText('Process Another')).toBeInTheDocument();
      }, { timeout: 2000 });

      fireEvent.click(screen.getByText('Process Another'));

      // Should reset to initial state
      await waitFor(() => {
        expect(screen.getByText('Upload Source Document')).toBeInTheDocument();
      });
    });
  });
});
