import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DocumentsPage from '@/features/documents/index';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

// Mock components that might cause issues
vi.mock('@/features/documents/components/TemplateGallery', () => ({
  TemplateGallery: ({ onSelectTemplate }: { onSelectTemplate: (template: any) => void }) => (
    <div>
      <button
        onClick={() => onSelectTemplate({
          id: 1,
          uuid: 'test-template-uuid',
          name: 'Test Template',
          description: 'A test template',
          template_content: 'Test content with {{variable}}',
          smart_variables: [
            {
              id: 'variable',
              name: 'variable',
              type: 'text',
              description: 'Test variable',
              extraction_hints: ['test'],
            }
          ],
          category: 'test'
        })}
      >
        Select Test Template
      </button>
    </div>
  ),
}));

// Mock router
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Template Data Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should navigate with template ID when template is selected', async () => {
    render(<DocumentsPage />);

    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText('Select Test Template')).toBeInTheDocument();
    });

    // Click the template selection button
    fireEvent.click(screen.getByText('Select Test Template'));

    // Verify navigation was called with correct parameters
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/documents/process',
      search: { templateId: '1' }
    });
  });

  it('should pass template data correctly in navigation', async () => {
    render(<DocumentsPage />);

    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText('Select Test Template')).toBeInTheDocument();
    });

    // Simulate template selection
    fireEvent.click(screen.getByText('Select Test Template'));

    // Verify the navigation includes the template ID as a string
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/documents/process',
      search: { templateId: '1' }
    });
  });

  it('should handle template creation modal trigger', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    render(<DocumentsPage />);

    // Find and click the "Create Template" button
    const createButton = screen.getByText('Create Template');
    fireEvent.click(createButton);

    // Verify the console log was called (temporary implementation)
    expect(consoleSpy).toHaveBeenCalledWith('Create new template');

    consoleSpy.mockRestore();
  });

  it('should display template gallery by default', async () => {
    render(<DocumentsPage />);

    // Verify the Template Gallery tab is active by default
    const galleryTab = screen.getByRole('tab', { name: /template gallery/i });
    expect(galleryTab).toHaveAttribute('data-state', 'active');
  });

  it('should switch between gallery and history views', async () => {
    render(<DocumentsPage />);

    // Click on Generated Documents tab
    const historyTab = screen.getByRole('tab', { name: /generated documents/i });
    fireEvent.click(historyTab);

    // Verify history tab is now active
    expect(historyTab).toHaveAttribute('data-state', 'active');

    // Verify history content is shown
    expect(screen.getByText('Generated Documents')).toBeInTheDocument();
    expect(screen.getByText('Your recently generated documents and their status')).toBeInTheDocument();
  });

  it('should display mock document history correctly', async () => {
    render(<DocumentsPage />);

    // Switch to history tab
    const historyTab = screen.getByRole('tab', { name: /generated documents/i });
    fireEvent.click(historyTab);

    // Verify mock documents are displayed
    expect(screen.getByText('Project Proposal')).toBeInTheDocument();
    expect(screen.getByText('Marketing Brief')).toBeInTheDocument();
    expect(screen.getByText('Contract Template')).toBeInTheDocument();

    // Verify status badges
    expect(screen.getAllByText('completed')).toHaveLength(2);
    expect(screen.getByText('processing')).toBeInTheDocument();
  });

  it('should handle document download', async () => {
    // Mock URL.createObjectURL and related DOM APIs
    const mockCreateObjectURL = vi.fn(() => 'mock-blob-url');
    const mockRevokeObjectURL = vi.fn();
    const mockClick = vi.fn();
    
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;
    
    // Mock document.createElement
    const mockAnchorElement = {
      href: '',
      download: '',
      click: mockClick,
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchorElement as any);

    render(<DocumentsPage />);

    // Switch to history tab
    const historyTab = screen.getByRole('tab', { name: /generated documents/i });
    fireEvent.click(historyTab);

    // Find and click a download button (only available for completed documents)
    const downloadButtons = screen.getAllByRole('button');
    const downloadButton = downloadButtons.find(button => 
      button.querySelector('svg') && button.getAttribute('aria-label') === null
    );
    
    if (downloadButton) {
      fireEvent.click(downloadButton);

      // Verify blob was created and download was triggered
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    }
  });
});
