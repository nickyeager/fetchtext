import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TemplateGalleryPage from '@/routes/_authenticated/templates';
import { WorkflowTemplate } from '@/types/workflows';

// Define types for mock components
interface TemplateGalleryProps {
  onPreviewTemplate: (template: WorkflowTemplate) => void;
  onUseTemplate: (template: WorkflowTemplate) => void;
  onCreateTemplate: () => void;
  onRefresh?: (refreshFn: () => Promise<void>) => void;
}

interface TemplatePreviewModalProps {
  isOpen: boolean;
  template?: WorkflowTemplate;
  onClose: () => void;
  onUse: (template: WorkflowTemplate) => void;
  onRate: (template: WorkflowTemplate, rating: number) => void;
}

interface CreateTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Mock dependencies
vi.mock('@/lib/template-service', () => ({
  TemplateService: {
    getTemplates: vi.fn(),
    getTemplate: vi.fn(),
    useTemplate: vi.fn(),
    rateTemplate: vi.fn(),
    createTemplate: vi.fn(),
  },
}));

const mockTemplateGallery = vi.fn();
vi.mock('@/components/templates/TemplateGallery', () => ({
  TemplateGallery: (props: TemplateGalleryProps) => {
    mockTemplateGallery(props);
    return (
      <div>
        <input placeholder="Search templates..." data-testid="search-input" />
        <select role="combobox" data-testid="sort-dropdown">
          <option value="name">Sort by Name</option>
          <option value="rating">Sort by Rating</option>
        </select>
        <button data-testid="create-new-template-button" onClick={props.onCreateTemplate}>Create New Template</button>
        <button data-testid="preview-template-button" onClick={() => props.onPreviewTemplate({ id: '1', name: 'Test Template Preview', templateType: 'n8n' })}>Preview Template</button>
        <button data-testid="use-template-gallery-button" onClick={() => props.onUseTemplate({ id: 'gallery-use-1', name: 'Gallery Use Template', templateType: 'n8n' })}>Use From Gallery</button>
      </div>
    );
  },
}));

const mockTemplatePreviewModal = vi.fn();
vi.mock('@/components/templates/TemplatePreviewModal', () => ({
  TemplatePreviewModal: (props: TemplatePreviewModalProps) => {
    mockTemplatePreviewModal(props);
    if (!props.isOpen) return null;
    return (
      <div data-testid="template-preview-modal">
        <h3>{props.template?.name}</h3>
        <button data-testid="close-preview-modal-button" onClick={props.onClose}>Close</button>
        <button data-testid="use-template-modal-button" onClick={() => props.template && props.onUse(props.template)}>Use This Template</button>
        <button data-testid="rate-template-modal-button" onClick={() => props.template && props.onRate(props.template, 5)}>Rate 5 Stars</button>
      </div>
    );
  },
}));

const mockCreateTemplateDialog = vi.fn();
vi.mock('@/components/templates/CreateTemplateDialog', () => ({
  CreateTemplateDialog: (props: CreateTemplateDialogProps) => {
    mockCreateTemplateDialog(props);
    if (!props.isOpen) return null;
    return (
      <div data-testid="create-template-dialog">
        <button data-testid="close-create-dialog-button" onClick={props.onClose}>Close Create</button>
        <button data-testid="submit-create-dialog-button" onClick={props.onSuccess}>Submit Create</button>
      </div>
    );
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Define types for mock services
interface MockTemplateService {
  getTemplates: ReturnType<typeof vi.fn>;
  getTemplate: ReturnType<typeof vi.fn>;
  useTemplate: ReturnType<typeof vi.fn>;
  rateTemplate: ReturnType<typeof vi.fn>;
  createTemplate: ReturnType<typeof vi.fn>;
}

interface MockToast {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
}

// Simplified mock for @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(() => (component: React.ComponentType) => component), // Return the component directly
  Route: vi.fn(() => (props: { children: React.ReactNode }) => <div>{props.children}</div>), // Mock Route component
}));

const mockTemplates: WorkflowTemplate[] = [
  { id: '1', name: 'Test Template 1', description: 'Desc 1', templateType: 'n8n', usageCount: 10, rating: 4.5 },
  { id: '2', name: 'Test Template 2', description: 'Desc 2', templateType: 'flowise', usageCount: 5, rating: 4.0 },
];

let TemplateService: MockTemplateService;
let toast: MockToast;

beforeEach(async () => {
  // Dynamically import mocked modules to get the mocked versions
  const tsModule = await import('@/lib/template-service');
  TemplateService = tsModule.TemplateService as unknown as MockTemplateService;
  const sonnerModule = await import('sonner');
  toast = sonnerModule.toast as unknown as MockToast;

  vi.clearAllMocks();
  (TemplateService.getTemplates as ReturnType<typeof vi.fn>).mockResolvedValue(mockTemplates);
  (TemplateService.useTemplate as ReturnType<typeof vi.fn>).mockResolvedValue('new-instance-id');
  (TemplateService.rateTemplate as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  (TemplateService.createTemplate as ReturnType<typeof vi.fn>).mockResolvedValue('new-template-id');
});

describe('TemplateGallery', () => {
  it('renders the template gallery heading', () => {
    render(<TemplateGalleryPage />);
    expect(screen.getByRole('heading', { name: /Workflow Template Gallery/i })).toBeInTheDocument();
  });

  it('renders the create template button', () => {
    render(<TemplateGalleryPage />);
    expect(screen.getByRole('button', { name: /Create New Template/i })).toBeInTheDocument();
  });

  it('renders the search input', () => {
    render(<TemplateGalleryPage />);
    expect(screen.getByPlaceholderText(/Search templates.../i)).toBeInTheDocument();
  });

  it('renders the sort dropdown', () => {
    render(<TemplateGalleryPage />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders template cards if available', async () => {
    render(<TemplateGalleryPage />);
    // Add assertions here, e.g., expect(await screen.findAllByTestId('template-card')).not.toHaveLength(0);
    // This is a placeholder, actual implementation will depend on the component
  });
});

describe('TemplateGalleryPage', () => {
  describe('Unit Tests', () => {
    it('renders initial state correctly', () => {
      render(<TemplateGalleryPage />);
      expect(screen.getByText('Workflow Template Gallery')).toBeInTheDocument();
      expect(mockTemplateGallery).toHaveBeenCalled();
      expect(screen.queryByTestId('template-preview-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('create-template-dialog')).not.toBeInTheDocument();
    });

    it('passes correct props to TemplateGallery', () => {
      render(<TemplateGalleryPage />);
      const galleryProps = mockTemplateGallery.mock.calls[0][0];
      expect(galleryProps.onPreviewTemplate).toBeInstanceOf(Function);
      expect(galleryProps.onUseTemplate).toBeInstanceOf(Function);
      expect(galleryProps.onCreateTemplate).toBeInstanceOf(Function);
    });
  });

  describe('Integration Tests', () => {
    it('handles previewing a template', async () => {
      render(<TemplateGalleryPage />);
      
      fireEvent.click(screen.getByTestId('preview-template-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('template-preview-modal')).toBeInTheDocument();
      });
      expect(screen.getByText('Test Template Preview')).toBeInTheDocument();

      const previewModalProps = mockTemplatePreviewModal.mock.calls[0][0];
      expect(previewModalProps.isOpen).toBe(true);
      expect(previewModalProps.template).toEqual({ id: '1', name: 'Test Template Preview', templateType: 'n8n' });

      fireEvent.click(screen.getByTestId('close-preview-modal-button'));
      await waitFor(() => {
        expect(screen.queryByTestId('template-preview-modal')).not.toBeInTheDocument();
      });
    });

    it('handles using a template successfully from preview modal', async () => {
      const mockTemplateToUse: WorkflowTemplate = { id: '1', name: 'Test Template Preview', templateType: 'n8n' };
      (TemplateService.useTemplate as ReturnType<typeof vi.fn>).mockResolvedValue('instance-123');

      render(<TemplateGalleryPage />);
      
      fireEvent.click(screen.getByTestId('preview-template-button'));
      await screen.findByTestId('template-preview-modal');

      fireEvent.click(screen.getByTestId('use-template-modal-button'));

      await waitFor(() => {
        expect(TemplateService.useTemplate).toHaveBeenCalledWith(
          mockTemplateToUse.id,
          `${mockTemplateToUse.name} - Instance`,
          {}
        );
      });
      
      expect(toast.success).toHaveBeenCalledWith(`Template "${mockTemplateToUse.name}" has been added to your workflows!`);
      expect(screen.queryByTestId('template-preview-modal')).not.toBeInTheDocument();
    });

    it('handles using a template with error from preview modal', async () => {
      const mockTemplateToUse: WorkflowTemplate = { id: '1', name: 'Test Template Preview', templateType: 'n8n' };
      (TemplateService.useTemplate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed to use'));

      render(<TemplateGalleryPage />);
      
      fireEvent.click(screen.getByTestId('preview-template-button'));
      await screen.findByTestId('template-preview-modal');
      
      fireEvent.click(screen.getByTestId('use-template-modal-button'));

      await waitFor(() => {
        expect(TemplateService.useTemplate).toHaveBeenCalledWith(
          mockTemplateToUse.id,
          `${mockTemplateToUse.name} - Instance`,
          {}
        );
      });
      
      expect(toast.error).toHaveBeenCalledWith('Failed to use template. Please try again.');
      expect(screen.getByTestId('template-preview-modal')).toBeInTheDocument(); 
    });

    it('handles opening and closing the create template dialog', async () => {
      render(<TemplateGalleryPage />);

      fireEvent.click(screen.getByTestId('create-new-template-button'));
      await waitFor(() => {
        expect(screen.getByTestId('create-template-dialog')).toBeInTheDocument();
      });
      
      // Check if the dialog is open by checking the most recent call to the mock
      const createDialogProps = mockCreateTemplateDialog.mock.calls[mockCreateTemplateDialog.mock.calls.length - 1][0];
      expect(createDialogProps.isOpen).toBe(true);

      fireEvent.click(screen.getByTestId('close-create-dialog-button'));
      await waitFor(() => {
        expect(screen.queryByTestId('create-template-dialog')).not.toBeInTheDocument();
      });
    });
    
    it('handles successful template creation callback from dialog', async () => {
      render(<TemplateGalleryPage />);

      fireEvent.click(screen.getByTestId('create-new-template-button'));
      await screen.findByTestId('create-template-dialog');
      
      fireEvent.click(screen.getByTestId('submit-create-dialog-button'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Template created successfully!');
      });
      expect(screen.queryByTestId('create-template-dialog')).not.toBeInTheDocument();
    });

    it('handles rating a template successfully from preview modal', async () => {
      const mockTemplateToRate: WorkflowTemplate = { id: '1', name: 'Test Template Preview', templateType: 'n8n' };
      (TemplateService.rateTemplate as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    
      render(<TemplateGalleryPage />);
      
      fireEvent.click(screen.getByTestId('preview-template-button'));
      await screen.findByTestId('template-preview-modal');
    
      fireEvent.click(screen.getByTestId('rate-template-modal-button'));
    
      await waitFor(() => {
        expect(TemplateService.rateTemplate).toHaveBeenCalledWith(mockTemplateToRate.id, 5);
      });
      expect(toast.success).toHaveBeenCalledWith(`Rated "${mockTemplateToRate.name}" with 5 stars!`);
    });

    it('handles rating a template with error from preview modal', async () => {
      const mockTemplateToRate: WorkflowTemplate = { id: '1', name: 'Test Template Preview', templateType: 'n8n' };
      (TemplateService.rateTemplate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed to rate'));

      render(<TemplateGalleryPage />);

      fireEvent.click(screen.getByTestId('preview-template-button'));
      await screen.findByTestId('template-preview-modal');

      fireEvent.click(screen.getByTestId('rate-template-modal-button'));

      await waitFor(() => {
        expect(TemplateService.rateTemplate).toHaveBeenCalledWith(mockTemplateToRate.id, 5);
      });
      expect(toast.error).toHaveBeenCalledWith('Failed to rate template. Please try again.');
    });
  });
});
