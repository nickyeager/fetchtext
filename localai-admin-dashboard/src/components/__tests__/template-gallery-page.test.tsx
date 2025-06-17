import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TemplateGalleryPage from '@/routes/_authenticated/templates';
import { WorkflowTemplate } from '@/types/workflows';

// Define types for mock components
interface TemplateGalleryProps {
  onCreateTemplate: () => void;
  onPreviewTemplate: (template: WorkflowTemplate) => void;
  onUseTemplate: (template: WorkflowTemplate) => void;
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

interface MockTemplateService {
  getTemplates: ReturnType<typeof vi.fn>;
  useTemplate: ReturnType<typeof vi.fn>;
  rateTemplate: ReturnType<typeof vi.fn>;
  createTemplate: ReturnType<typeof vi.fn>;
}

interface MockToast {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
}

// Mock TemplateService
vi.mock('@/lib/template-service', () => ({
  TemplateService: {
    getTemplates: vi.fn(),
    useTemplate: vi.fn(),
    rateTemplate: vi.fn(),
    createTemplate: vi.fn(),
  },
}));

vi.mock('@/components/templates/TemplateGallery', () => ({
  TemplateGallery: (props: TemplateGalleryProps) => (
    <div data-testid="template-gallery">
      <button data-testid="create-new-template-button" onClick={props.onCreateTemplate}>Create New Template</button>
      <button data-testid="preview-template-button" onClick={() => props.onPreviewTemplate({ id: '1', name: 'Test Template Preview', templateType: 'n8n' })}>Preview Template</button>
      <button data-testid="use-template-gallery-button" onClick={() => props.onUseTemplate({ id: 'gallery-use-1', name: 'Gallery Use Template', templateType: 'n8n' })}>Use From Gallery</button>
    </div>
  ),
}));

vi.mock('@/components/templates/TemplatePreviewModal', () => ({
  TemplatePreviewModal: (props: TemplatePreviewModalProps) => {
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

vi.mock('@/components/templates/CreateTemplateDialog', () => ({
  CreateTemplateDialog: (props: CreateTemplateDialogProps) => {
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

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(() => (component: React.ComponentType) => component),
}));

describe('TemplateGalleryPage', () => {
  let mockTemplateService: MockTemplateService;
  let mockToast: MockToast;

  beforeEach(async () => {
    const templateServiceModule = await import('@/lib/template-service');
    const sonnerModule = await import('sonner');

    mockTemplateService = templateServiceModule.TemplateService as unknown as MockTemplateService;
    mockToast = sonnerModule.toast as unknown as MockToast;

    vi.clearAllMocks();
    mockTemplateService.useTemplate.mockResolvedValue('new-instance-id');
    mockTemplateService.rateTemplate.mockResolvedValue(true);
    mockTemplateService.createTemplate.mockResolvedValue('new-template-id');
  });

  it('renders the template gallery page', () => {
    render(<TemplateGalleryPage />);
    
    expect(screen.getByText('Workflow Template Gallery')).toBeInTheDocument();
    expect(screen.getByTestId('template-gallery')).toBeInTheDocument();
  });

  it('handles previewing a template', async () => {
    render(<TemplateGalleryPage />);
    
    fireEvent.click(screen.getByTestId('preview-template-button'));
    
    await waitFor(() => {
      expect(screen.getByTestId('template-preview-modal')).toBeInTheDocument();
      expect(screen.getByText('Test Template Preview')).toBeInTheDocument();
    });
  });

  it('handles closing the preview modal', async () => {
    render(<TemplateGalleryPage />);
    
    fireEvent.click(screen.getByTestId('preview-template-button'));
    await screen.findByTestId('template-preview-modal');
    
    fireEvent.click(screen.getByTestId('close-preview-modal-button'));
    
    await waitFor(() => {
      expect(screen.queryByTestId('template-preview-modal')).not.toBeInTheDocument();
    });
  });

  it('handles using a template successfully', async () => {
    const mockTemplate: WorkflowTemplate = { id: '1', name: 'Test Template Preview', templateType: 'n8n' };
    
    render(<TemplateGalleryPage />);
    
    fireEvent.click(screen.getByTestId('preview-template-button'));
    await screen.findByTestId('template-preview-modal');
    
    fireEvent.click(screen.getByTestId('use-template-modal-button'));

    await waitFor(() => {
      expect(mockTemplateService.useTemplate).toHaveBeenCalledWith(
        mockTemplate.id,
        `${mockTemplate.name} - Instance`,
        {}
      );
      expect(mockToast.success).toHaveBeenCalledWith(`Template "${mockTemplate.name}" has been added to your workflows!`);
    });
  });

  it('handles template rating successfully', async () => {
    const mockTemplate: WorkflowTemplate = { id: '1', name: 'Test Template Preview', templateType: 'n8n' };
    
    render(<TemplateGalleryPage />);
    
    fireEvent.click(screen.getByTestId('preview-template-button'));
    await screen.findByTestId('template-preview-modal');
    
    fireEvent.click(screen.getByTestId('rate-template-modal-button'));

    await waitFor(() => {
      expect(mockTemplateService.rateTemplate).toHaveBeenCalledWith(mockTemplate.id, 5);
      expect(mockToast.success).toHaveBeenCalledWith(`Rated "${mockTemplate.name}" with 5 stars!`);
    });
  });

  it('handles opening and closing the create template dialog', async () => {
    render(<TemplateGalleryPage />);

    fireEvent.click(screen.getByTestId('create-new-template-button'));
    
    await waitFor(() => {
      expect(screen.getByTestId('create-template-dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('close-create-dialog-button'));
    
    await waitFor(() => {
      expect(screen.queryByTestId('create-template-dialog')).not.toBeInTheDocument();
    });
  });

  it('handles successful template creation', async () => {
    render(<TemplateGalleryPage />);

    fireEvent.click(screen.getByTestId('create-new-template-button'));
    await screen.findByTestId('create-template-dialog');
    
    fireEvent.click(screen.getByTestId('submit-create-dialog-button'));

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Template created successfully!');
      expect(screen.queryByTestId('create-template-dialog')).not.toBeInTheDocument();
    });
  });

  it('handles template usage error', async () => {
    mockTemplateService.useTemplate.mockRejectedValue(new Error('Failed to use template'));
    
    render(<TemplateGalleryPage />);
    
    fireEvent.click(screen.getByTestId('preview-template-button'));
    await screen.findByTestId('template-preview-modal');
    
    fireEvent.click(screen.getByTestId('use-template-modal-button'));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Failed to use template. Please try again.');
      expect(screen.getByTestId('template-preview-modal')).toBeInTheDocument();
    });
  });

  it('handles template rating error', async () => {
    mockTemplateService.rateTemplate.mockRejectedValue(new Error('Failed to rate template'));
    
    render(<TemplateGalleryPage />);
    
    fireEvent.click(screen.getByTestId('preview-template-button'));
    await screen.findByTestId('template-preview-modal');
    
    fireEvent.click(screen.getByTestId('rate-template-modal-button'));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Failed to rate template. Please try again.');
    });
  });
});
