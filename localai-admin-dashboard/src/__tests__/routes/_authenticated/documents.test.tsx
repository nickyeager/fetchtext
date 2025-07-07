import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DocumentsPage from '@/features/documents';

// Mock TanStack Router hooks
vi.mock('@tanstack/react-router', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  useRouter: vi.fn(() => ({
    navigate: vi.fn(),
    state: {
      location: {
        pathname: '/documents',
        search: '',
        hash: ''
      }
    }
  })),
  createFileRoute: vi.fn(),
}));

// Mock any dependencies that DocumentsPage might have
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
    })),
  },
}));

// Mock child components to avoid their router dependencies
vi.mock('@/features/documents/components/TemplateGallery', () => ({
  TemplateGallery: () => <div data-testid="template-gallery">Template Gallery Component</div>
}));

vi.mock('@/features/documents/components/DocumentProcessor', () => ({
  DocumentProcessor: () => <div data-testid="document-processor">Document Processor Component</div>
}));

describe('Documents Route Tests', () => {
  it('should render the DocumentsPage component', () => {
    render(<DocumentsPage />);
    
    expect(screen.getByText('Document Automation')).toBeInTheDocument();
    expect(screen.getByText('Create intelligent documents using AI-powered templates')).toBeInTheDocument();
  });

  it('should show the navigation tabs', () => {
    render(<DocumentsPage />);
    
    // Check that the main tabs are present
    expect(screen.getByText('Template Gallery')).toBeInTheDocument();
    expect(screen.getByText('Generated Documents')).toBeInTheDocument();
    
    // Check that the action buttons are present
    expect(screen.getByText('Create Template')).toBeInTheDocument();
    expect(screen.getByText('Start Processing')).toBeInTheDocument();
  });

  it('should show the template gallery content by default', () => {
    render(<DocumentsPage />);
    
    // The mocked TemplateGallery component should be visible
    expect(screen.getByTestId('template-gallery')).toBeInTheDocument();
    expect(screen.getByText('Template Gallery Component')).toBeInTheDocument();
  });

  it('should not show the old placeholder message', () => {
    render(<DocumentsPage />);
    
    // Should not show the old placeholder message
    expect(screen.queryByText('Hello "/_authenticated/documents/"!')).not.toBeInTheDocument();
  });
});
