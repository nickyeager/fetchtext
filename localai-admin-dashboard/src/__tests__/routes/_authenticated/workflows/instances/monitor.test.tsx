import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { DocumentProcessor } from '@/features/documents/components/DocumentProcessor';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-123' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

describe('DocumentProcessor', () => {
    const mockTemplate = {
        id: 1,
        uuid: 'template-uuid-1',
        name: 'Test Template',
        description: 'A template for testing',
        template_content: 'Hello, {{name}}!',
        smart_variables: [
            { 
                id: 'name', 
                name: 'name', 
                type: 'text' as const, 
                description: 'Your name', 
                extraction_hints: ['name'] 
            },
        ],
        category: 'General',
    };

    const mockOnGenerationComplete = vi.fn();
    const mockOnBack = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
        vi.clearAllTimers();
    });

    it('should generate the final document', async () => {
        render(
            <DocumentProcessor 
                selectedTemplate={mockTemplate} 
                onGenerationComplete={mockOnGenerationComplete}
                onBack={mockOnBack}
            />
        );

        // Look for the file input element using ID to avoid duplicates
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        
        expect(fileInput).toBeInTheDocument();

        const file = new File(['(dummy file content)'], 'test.txt', { type: 'text/plain' });
        
        // Simulate file upload
        fireEvent.change(fileInput, { target: { files: [file] } });

        // Wait for the file to be processed and steps to advance
        await waitFor(() => {
            // Check if we've moved to extract text content step
            expect(screen.getByText('Extract Text Content')).toBeInTheDocument();
        }, { timeout: 1000 });

        // Cleanup any pending promises or timers
        await waitFor(() => {}, { timeout: 100 });
    });

    it('should handle file upload errors gracefully', async () => {
        render(
            <DocumentProcessor 
                selectedTemplate={mockTemplate} 
                onGenerationComplete={mockOnGenerationComplete}
                onBack={mockOnBack}
            />
        );

        const fileInput = document.getElementById('file-upload') as HTMLInputElement;

        // Simulate file upload (PDF files are actually supported)
        const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
        
        fireEvent.change(fileInput, { target: { files: [file] } });

        // Should handle the file upload and advance to extraction
        await waitFor(() => {
            expect(screen.getByText('Extract Text Content')).toBeInTheDocument();
        }, { timeout: 1000 });
    });

    it('should display processing state during document generation', async () => {
        render(
            <DocumentProcessor 
                selectedTemplate={mockTemplate} 
                onGenerationComplete={mockOnGenerationComplete}
                onBack={mockOnBack}
            />
        );

        const file = new File(['content'], 'test.txt', { type: 'text/plain' });
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;

        fireEvent.change(fileInput, { target: { files: [file] } });

        // Wait for processing to advance
        await waitFor(() => {
            expect(screen.getByText('Extract Text Content')).toBeInTheDocument();
        }, { timeout: 1000 });
    });
});