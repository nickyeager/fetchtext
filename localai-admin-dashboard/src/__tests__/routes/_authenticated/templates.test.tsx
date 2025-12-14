import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Import the actual component
import { TemplateGalleryPage } from '../../../routes/_authenticated/templates'

// Mock all the dependencies
vi.mock('@/lib/template-service', () => ({
  TemplateService: {
    getTemplates: vi.fn(),
    getTemplate: vi.fn(),
    useTemplate: vi.fn(),
    rateTemplate: vi.fn(),
    createTemplate: vi.fn(),
  },
}))

vi.mock('@/components/templates/TemplateGallery', () => ({
  TemplateGallery: ({ onPreviewTemplate, onUseTemplate, onCreateTemplate }: any) => (
    <div data-testid="template-gallery">
      <button data-testid="preview-button" onClick={() => onPreviewTemplate({ id: '1', name: 'Test Template', templateType: 'n8n' })}>
        Preview Template
      </button>
      <button data-testid="use-button" onClick={() => onUseTemplate({ id: '1', name: 'Test Template', templateType: 'n8n' })}>
        Use Template
      </button>
      <button data-testid="create-button" onClick={onCreateTemplate}>
        Create Template
      </button>
    </div>
  ),
}))

vi.mock('@/components/templates/TemplatePreviewModal', () => ({
  TemplatePreviewModal: ({ isOpen, onClose, template, onUse, onRate }: any) => {
    if (!isOpen) return null
    return (
      <div data-testid="preview-modal">
        <h3>{template?.name}</h3>
        <button data-testid="modal-close" onClick={onClose}>Close</button>
        <button data-testid="modal-use" onClick={() => onUse(template)}>Use</button>
        <button data-testid="modal-rate" onClick={() => onRate(template, 5)}>Rate 5</button>
      </div>
    )
  },
}))

vi.mock('@/components/templates/CreateTemplateDialog', () => ({
  CreateTemplateDialog: ({ isOpen, onClose, onSuccess }: any) => {
    if (!isOpen) return null
    return (
      <div data-testid="create-dialog">
        <button data-testid="dialog-close" onClick={onClose}>Close</button>
        <button data-testid="dialog-submit" onClick={onSuccess}>Submit</button>
      </div>
    )
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@tanstack/react-router', () => ({
  ...vi.importActual('@tanstack/react-router'),
  useNavigate: () => vi.fn(),
  createFileRoute: () => (options: any) => ({
    ...options,
    component: () => <div />,
  }),
}))

describe('TemplateGalleryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the template gallery page', () => {
    render(<TemplateGalleryPage />)
    
    expect(screen.getByText('Workflow Template Gallery')).toBeInTheDocument()
    expect(screen.getByTestId('template-gallery')).toBeInTheDocument()
  })

  it('opens preview modal when preview button is clicked', async () => {
    render(<TemplateGalleryPage />)
    
    fireEvent.click(screen.getByTestId('preview-button'))
    
    await waitFor(() => {
      expect(screen.getByTestId('preview-modal')).toBeInTheDocument()
      expect(screen.getByText('Test Template')).toBeInTheDocument()
    })
  })

  it('closes preview modal when close button is clicked', async () => {
    render(<TemplateGalleryPage />)
    
    fireEvent.click(screen.getByTestId('preview-button'))
    await screen.findByTestId('preview-modal')
    
    fireEvent.click(screen.getByTestId('modal-close'))
    
    await waitFor(() => {
      expect(screen.queryByTestId('preview-modal')).not.toBeInTheDocument()
    })
  })

  it('opens create dialog when create button is clicked', async () => {
    render(<TemplateGalleryPage />)
    
    fireEvent.click(screen.getByTestId('create-button'))
    
    await waitFor(() => {
      expect(screen.getByTestId('create-dialog')).toBeInTheDocument()
    })
  })

  it('closes create dialog when close button is clicked', async () => {
    render(<TemplateGalleryPage />)
    
    fireEvent.click(screen.getByTestId('create-button'))
    await screen.findByTestId('create-dialog')
    
    fireEvent.click(screen.getByTestId('dialog-close'))
    
    await waitFor(() => {
      expect(screen.queryByTestId('create-dialog')).not.toBeInTheDocument()
    })
  })
})
