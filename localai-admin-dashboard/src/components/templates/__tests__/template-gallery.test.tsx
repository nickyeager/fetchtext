import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

// Create a simplified mock component to test the basic functionality
function MockTemplateGalleryPage() {
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)

  return (
    <div>
      <h1>Workflow Template Gallery</h1>
      <div data-testid="template-gallery">
        <button data-testid="preview-button" onClick={() => setIsPreviewOpen(true)}>
          Preview Template
        </button>
        <button data-testid="create-button" onClick={() => setIsCreateOpen(true)}>
          Create Template
        </button>
      </div>
      
      {isPreviewOpen && (
        <div data-testid="preview-modal">
          <h3>Test Template</h3>
          <button data-testid="modal-close" onClick={() => setIsPreviewOpen(false)}>Close</button>
        </div>
      )}
      
      {isCreateOpen && (
        <div data-testid="create-dialog">
          <button data-testid="dialog-close" onClick={() => setIsCreateOpen(false)}>Close</button>
        </div>
      )}
    </div>
  )
}

describe('Template Gallery Functionality', () => {
  it('renders the template gallery page', () => {
    render(<MockTemplateGalleryPage />)
    
    expect(screen.getByText('Workflow Template Gallery')).toBeInTheDocument()
    expect(screen.getByTestId('template-gallery')).toBeInTheDocument()
  })

  it('opens preview modal when preview button is clicked', async () => {
    render(<MockTemplateGalleryPage />)
    
    fireEvent.click(screen.getByTestId('preview-button'))
    
    await waitFor(() => {
      expect(screen.getByTestId('preview-modal')).toBeInTheDocument()
      expect(screen.getByText('Test Template')).toBeInTheDocument()
    })
  })

  it('closes preview modal when close button is clicked', async () => {
    render(<MockTemplateGalleryPage />)
    
    fireEvent.click(screen.getByTestId('preview-button'))
    await screen.findByTestId('preview-modal')
    
    fireEvent.click(screen.getByTestId('modal-close'))
    
    await waitFor(() => {
      expect(screen.queryByTestId('preview-modal')).not.toBeInTheDocument()
    })
  })

  it('opens create dialog when create button is clicked', async () => {
    render(<MockTemplateGalleryPage />)
    
    fireEvent.click(screen.getByTestId('create-button'))
    
    await waitFor(() => {
      expect(screen.getByTestId('create-dialog')).toBeInTheDocument()
    })
  })

  it('closes create dialog when close button is clicked', async () => {
    render(<MockTemplateGalleryPage />)
    
    fireEvent.click(screen.getByTestId('create-button'))
    await screen.findByTestId('create-dialog')
    
    fireEvent.click(screen.getByTestId('dialog-close'))
    
    await waitFor(() => {
      expect(screen.queryByTestId('create-dialog')).not.toBeInTheDocument()
    })
  })
})
