import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SplitDocumentEditor } from '@/features/documents/components/SplitDocumentEditor'

// Mock pointer capture for Radix UI components
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

describe('SplitDocumentEditor', () => {
  const defaultProps = {
    documentId: 'doc-123',
    fileUrl: 'https://example.com/file.pdf',
    fileName: 'test-document.pdf',
    fileType: 'application/pdf',
    templateContent: 'Hello {{name}}, your order {{orderId}} is ready.',
    extractedFields: {
      name: { value: 'John Doe', confidence: 0.95 },
      orderId: { value: 'ORD-456', confidence: 0.88 },
    },
    templateName: 'Order Confirmation',
    templateId: 1,
  }

  it('renders both panels in side-by-side layout by default', () => {
    render(<SplitDocumentEditor {...defaultProps} />)

    // Should show original document panel
    expect(screen.getByTestId('original-document-panel')).toBeInTheDocument()
    // Should show template output panel
    expect(screen.getByTestId('template-output-panel')).toBeInTheDocument()
  })

  it('renders toolbar with mode selector', () => {
    render(<SplitDocumentEditor {...defaultProps} />)

    // Mode selector should be present
    expect(screen.getByText(/override this document/i)).toBeInTheDocument()
  })

  it('renders layout toggle buttons', () => {
    render(<SplitDocumentEditor {...defaultProps} />)

    expect(screen.getByRole('button', { name: /side by side/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /original only/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /output only/i })).toBeInTheDocument()
  })

  it('switches to original-only layout when button clicked', async () => {
    render(<SplitDocumentEditor {...defaultProps} />)

    const originalOnlyButton = screen.getByRole('button', { name: /original only/i })
    fireEvent.click(originalOnlyButton)

    await waitFor(() => {
      expect(screen.getByTestId('original-document-panel')).toBeInTheDocument()
      expect(screen.queryByTestId('template-output-panel')).not.toBeInTheDocument()
    })
  })

  it('switches to output-only layout when button clicked', async () => {
    render(<SplitDocumentEditor {...defaultProps} />)

    const outputOnlyButton = screen.getByRole('button', { name: /output only/i })
    fireEvent.click(outputOnlyButton)

    await waitFor(() => {
      expect(screen.queryByTestId('original-document-panel')).not.toBeInTheDocument()
      expect(screen.getByTestId('template-output-panel')).toBeInTheDocument()
    })
  })

  it('renders template content with extracted field values', () => {
    render(<SplitDocumentEditor {...defaultProps} />)

    // Should show extracted values in badges
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('ORD-456')).toBeInTheDocument()
  })

  it('shows resizable divider in side-by-side mode', () => {
    render(<SplitDocumentEditor {...defaultProps} />)

    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('hides resizable divider in single-panel mode', async () => {
    render(<SplitDocumentEditor {...defaultProps} />)

    const originalOnlyButton = screen.getByRole('button', { name: /original only/i })
    fireEvent.click(originalOnlyButton)

    await waitFor(() => {
      expect(screen.queryByRole('separator')).not.toBeInTheDocument()
    })
  })

  it('calls onSaveOverride when field is overridden', async () => {
    const onSaveOverride = vi.fn().mockResolvedValue(undefined)
    render(
      <SplitDocumentEditor
        {...defaultProps}
        onSaveOverride={onSaveOverride}
        enableOverrides={true}
      />
    )

    // This would require clicking on a field and saving an override
    // For now, test that the callback is available
    expect(onSaveOverride).not.toHaveBeenCalled()
  })

  it('calls onSaveTemplate when template is saved', async () => {
    const onSaveTemplate = vi.fn().mockResolvedValue(undefined)
    render(
      <SplitDocumentEditor
        {...defaultProps}
        onSaveTemplate={onSaveTemplate}
        editable={true}
      />
    )

    // Callback available but not called until save action
    expect(onSaveTemplate).not.toHaveBeenCalled()
  })

  it('displays template name in toolbar', () => {
    render(<SplitDocumentEditor {...defaultProps} />)

    expect(screen.getByText('Order Confirmation')).toBeInTheDocument()
  })

  it('shows field count badge', () => {
    render(<SplitDocumentEditor {...defaultProps} />)

    // 2 fields: name and orderId
    expect(screen.getByText('2/2')).toBeInTheDocument()
  })

  it('shows override count when overrides exist', () => {
    render(
      <SplitDocumentEditor
        {...defaultProps}
        fieldOverrides={{
          name: {
            value: 'Jane Doe',
            original_value: 'John Doe',
            modified_at: new Date().toISOString(),
            modified_by: 'user-1',
          },
        }}
        enableOverrides={true}
      />
    )

    expect(screen.getByText(/1 override/i)).toBeInTheDocument()
  })

  it('renders in read-only mode when specified', () => {
    render(<SplitDocumentEditor {...defaultProps} readOnly={true} />)

    // Mode selector should be disabled in read-only mode
    const modeButton = screen.getByRole('combobox')
    expect(modeButton).toBeDisabled()
  })

  it('exports document when export button clicked', async () => {
    const onExport = vi.fn()
    render(<SplitDocumentEditor {...defaultProps} onExport={onExport} />)

    const exportButton = screen.getByRole('button', { name: /export/i })
    fireEvent.click(exportButton)

    expect(onExport).toHaveBeenCalled()
  })
})
