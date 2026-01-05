import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnifiedDocumentView } from '@/features/documents/components/UnifiedDocumentView'

// Mock the DocumentProcessorEnhanced for extraction tests
vi.mock('@/lib/document-processor-enhanced', () => ({
  DocumentProcessorEnhanced: vi.fn().mockImplementation(() => ({
    extractWithTemplateFast: vi.fn().mockResolvedValue({
      new_variable: { value: 'Extracted Value', confidence: 0.85 },
    }),
  })),
}))

describe('UnifiedDocumentView', () => {
  const defaultProps = {
    fileUrl: 'https://example.com/document.pdf',
    fileName: 'test-document.pdf',
    fileType: 'application/pdf',
    fileSize: 1024 * 100, // 100KB
    templateContent: 'Invoice for {{company_name}}: {{total_amount}}',
    extractedFields: {
      company_name: { value: 'Acme Corp', confidence: 0.95 },
      total_amount: { value: '$500.00', confidence: 0.92 },
    },
    templateName: 'Invoice Template',
    templateId: 1,
  }

  describe('Toggle Switch', () => {
    it('renders toggle switch with Original and Output labels', () => {
      render(<UnifiedDocumentView {...defaultProps} />)

      expect(screen.getByText('Original')).toBeInTheDocument()
      expect(screen.getByText('Output')).toBeInTheDocument()
      expect(screen.getByRole('switch')).toBeInTheDocument()
    })

    it('defaults to Output view (switch checked)', () => {
      render(<UnifiedDocumentView {...defaultProps} />)

      const toggle = screen.getByRole('switch')
      expect(toggle).toBeChecked()
    })

    it('shows Generated Output panel by default', () => {
      render(<UnifiedDocumentView {...defaultProps} />)

      // Output view should be visible
      expect(screen.getByText(/Generated Output/)).toBeInTheDocument()
      // Original document preview should NOT be visible
      expect(screen.queryByText('Original Document')).not.toBeInTheDocument()
    })

    it('switches to Original view when toggle is clicked', async () => {
      const user = userEvent.setup()
      render(<UnifiedDocumentView {...defaultProps} />)

      const toggle = screen.getByRole('switch')
      await user.click(toggle)

      // Original document preview should now be visible
      expect(screen.getByText('Original Document')).toBeInTheDocument()
      // Output view should NOT be visible
      expect(screen.queryByText(/Generated Output/)).not.toBeInTheDocument()
    })

    it('switches back to Output view when toggled again', async () => {
      const user = userEvent.setup()
      render(<UnifiedDocumentView {...defaultProps} />)

      const toggle = screen.getByRole('switch')

      // Toggle to Original
      await user.click(toggle)
      expect(screen.getByText('Original Document')).toBeInTheDocument()

      // Toggle back to Output
      await user.click(toggle)
      expect(screen.getByText(/Generated Output/)).toBeInTheDocument()
      expect(screen.queryByText('Original Document')).not.toBeInTheDocument()
    })

    it('highlights active label (Output by default)', () => {
      render(<UnifiedDocumentView {...defaultProps} />)

      const outputLabel = screen.getByText('Output')
      const originalLabel = screen.getByText('Original')

      // Active label has text-foreground, inactive has text-muted-foreground
      expect(outputLabel).toHaveClass('text-foreground')
      expect(originalLabel).toHaveClass('text-muted-foreground')
    })

    it('highlights Original label when switched', async () => {
      const user = userEvent.setup()
      render(<UnifiedDocumentView {...defaultProps} />)

      await user.click(screen.getByRole('switch'))

      const outputLabel = screen.getByText('Output')
      const originalLabel = screen.getByText('Original')

      // After toggle, Original should be active
      expect(originalLabel).toHaveClass('text-foreground')
      expect(outputLabel).toHaveClass('text-muted-foreground')
    })
  })

  describe('Output View (Template Output)', () => {
    it('renders extracted field values', () => {
      render(<UnifiedDocumentView {...defaultProps} />)

      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
      expect(screen.getByText('$500.00')).toBeInTheDocument()
    })

    it('shows template name', () => {
      render(<UnifiedDocumentView {...defaultProps} />)

      expect(screen.getByText(/Invoice Template/)).toBeInTheDocument()
    })

    it('shows field count badge', () => {
      render(<UnifiedDocumentView {...defaultProps} />)

      expect(screen.getByText('2/2 fields')).toBeInTheDocument()
    })

    it('calls onEditTemplate when edit button clicked', async () => {
      const user = userEvent.setup()
      const mockEdit = vi.fn()

      render(<UnifiedDocumentView {...defaultProps} onEditTemplate={mockEdit} />)

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      expect(mockEdit).toHaveBeenCalled()
    })

    it('calls onExport when export button clicked', async () => {
      const user = userEvent.setup()
      const mockExport = vi.fn()

      render(<UnifiedDocumentView {...defaultProps} onExport={mockExport} />)

      const exportButton = screen.getByRole('button', { name: /export/i })
      await user.click(exportButton)

      expect(mockExport).toHaveBeenCalled()
    })
  })

  describe('Original View (Document Preview)', () => {
    it('shows document preview when toggled to Original', async () => {
      const user = userEvent.setup()
      render(<UnifiedDocumentView {...defaultProps} />)

      await user.click(screen.getByRole('switch'))

      expect(screen.getByText('Original Document')).toBeInTheDocument()
      expect(screen.getByText(/test-document\.pdf/)).toBeInTheDocument()
    })

    it('displays file size in document preview', async () => {
      const user = userEvent.setup()
      render(<UnifiedDocumentView {...defaultProps} />)

      await user.click(screen.getByRole('switch'))

      expect(screen.getByText(/100.*KB/i)).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles null fileUrl gracefully', async () => {
      const user = userEvent.setup()
      render(<UnifiedDocumentView {...defaultProps} fileUrl={null} />)

      await user.click(screen.getByRole('switch'))

      // Should still render without crashing - shows fallback message
      expect(screen.getByText('No document file available')).toBeInTheDocument()
    })

    it('handles empty extractedFields', () => {
      render(
        <UnifiedDocumentView
          {...defaultProps}
          templateContent="Hello {{name}}"
          extractedFields={{}}
        />
      )

      expect(screen.getByText('0/0 fields')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(
        <UnifiedDocumentView {...defaultProps} className="custom-class" />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('handles missing template name', () => {
      render(
        <UnifiedDocumentView
          {...defaultProps}
          templateName={undefined}
        />
      )

      expect(screen.getByText(/No template applied/)).toBeInTheDocument()
    })
  })

  describe('Editable Mode', () => {
    it('passes editable prop to TemplateOutputView', () => {
      render(
        <UnifiedDocumentView
          {...defaultProps}
          editable={true}
          documentText="Sample document text"
        />
      )

      // When editable, should show textarea
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('passes onTemplateChange to TemplateOutputView', async () => {
      const user = userEvent.setup()
      const mockOnTemplateChange = vi.fn()

      render(
        <UnifiedDocumentView
          {...defaultProps}
          editable={true}
          documentText="Sample document text"
          onTemplateChange={mockOnTemplateChange}
        />
      )

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, ' extra')

      expect(mockOnTemplateChange).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has accessible toggle switch with aria-label', () => {
      render(<UnifiedDocumentView {...defaultProps} />)

      const toggle = screen.getByRole('switch')
      expect(toggle).toHaveAttribute('aria-label', 'Toggle between original document and generated output')
    })

    it('has labels associated with toggle via htmlFor', () => {
      render(<UnifiedDocumentView {...defaultProps} />)

      // Labels should have htmlFor pointing to the switch
      const originalLabel = screen.getByText('Original')
      const outputLabel = screen.getByText('Output')

      expect(originalLabel).toHaveAttribute('for', 'view-toggle')
      expect(outputLabel).toHaveAttribute('for', 'view-toggle')
    })
  })
})
