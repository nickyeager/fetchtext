/**
 * DocumentTemplateEditor Tests
 *
 * Tests for the WYSIWYG editor wrapper for document editing.
 * This editor displays template content with editable variable values.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { DocumentTemplateEditor } from '@/features/documents/components/DocumentTemplateEditor'

// Longer timeout for TipTap editor initialization
const EDITOR_INIT_TIMEOUT = { timeout: 5000 }

describe('DocumentTemplateEditor', () => {
  const simpleContent = '<p>Hello World</p>'
  const contentWithVariable =
    '<p>Hello <span data-variable-badge data-variable-id="name" data-variable-name="Name">{{Name}}</span>!</p>'

  const defaultProps = {
    content: simpleContent,
    onChange: vi.fn(),
    extractedData: { name: 'John Doe' },
    onValueChange: vi.fn().mockResolvedValue(undefined),
    onResetOverride: vi.fn().mockResolvedValue(undefined),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders editor container', () => {
      render(<DocumentTemplateEditor {...defaultProps} />)

      // Editor container should be present immediately
      expect(
        document.querySelector('.document-template-editor')
      ).toBeInTheDocument()
    })

    it('renders toolbar when showToolbar is true', () => {
      render(<DocumentTemplateEditor {...defaultProps} showToolbar={true} />)

      // Toolbar should be present (toolbar renders synchronously)
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('hides toolbar when showToolbar is false', () => {
      render(<DocumentTemplateEditor {...defaultProps} showToolbar={false} />)

      // No toolbar buttons should be present
      const editorContainer = document.querySelector('.document-template-editor')
      expect(editorContainer).toBeInTheDocument()

      // Toolbar div should not exist
      const toolbar = document.querySelector('.flex.flex-wrap.items-center.gap-1')
      expect(toolbar).not.toBeInTheDocument()
    })

    it('renders in read-only mode when readOnly is true', () => {
      render(<DocumentTemplateEditor {...defaultProps} readOnly={true} />)

      // Editor container should be present
      expect(
        document.querySelector('.document-template-editor')
      ).toBeInTheDocument()

      // Toolbar should not be present in read-only mode
      const toolbar = document.querySelector('.flex.flex-wrap.items-center.gap-1')
      expect(toolbar).not.toBeInTheDocument()
    })

    it('renders ProseMirror editor when initialized', async () => {
      render(<DocumentTemplateEditor {...defaultProps} />)

      await waitFor(
        () => {
          expect(document.querySelector('.ProseMirror')).toBeInTheDocument()
        },
        EDITOR_INIT_TIMEOUT
      )
    })
  })

  describe('value editing', () => {
    it('renders with variable content', async () => {
      render(
        <DocumentTemplateEditor {...defaultProps} content={contentWithVariable} />
      )

      // Wait for editor to initialize
      await waitFor(
        () => {
          expect(document.querySelector('.ProseMirror')).toBeInTheDocument()
        },
        EDITOR_INIT_TIMEOUT
      )
    })

    it('renders with field overrides prop', () => {
      render(
        <DocumentTemplateEditor
          {...defaultProps}
          content={contentWithVariable}
          extractedData={{ name: 'Original' }}
          fieldOverrides={{
            name: {
              value: 'Override Value',
              original_value: 'Original',
              modified_at: new Date().toISOString(),
            },
          }}
        />
      )

      // Component should render without errors
      expect(
        document.querySelector('.document-template-editor')
      ).toBeInTheDocument()
    })
  })

  describe('props handling', () => {
    it('accepts onChange callback', () => {
      const mockOnChange = vi.fn()

      render(
        <DocumentTemplateEditor {...defaultProps} onChange={mockOnChange} />
      )

      // Component should render without errors
      expect(
        document.querySelector('.document-template-editor')
      ).toBeInTheDocument()
    })

    it('accepts onValueChange callback', () => {
      const mockOnValueChange = vi.fn().mockResolvedValue(undefined)

      render(
        <DocumentTemplateEditor
          {...defaultProps}
          onValueChange={mockOnValueChange}
        />
      )

      // Component should render without errors
      expect(
        document.querySelector('.document-template-editor')
      ).toBeInTheDocument()
    })

    it('accepts onResetOverride callback', () => {
      const mockOnResetOverride = vi.fn().mockResolvedValue(undefined)

      render(
        <DocumentTemplateEditor
          {...defaultProps}
          onResetOverride={mockOnResetOverride}
        />
      )

      // Component should render without errors
      expect(
        document.querySelector('.document-template-editor')
      ).toBeInTheDocument()
    })
  })

  describe('height configuration', () => {
    it('renders with custom height prop', () => {
      render(<DocumentTemplateEditor {...defaultProps} height="200px" />)

      expect(
        document.querySelector('.document-template-editor')
      ).toBeInTheDocument()
    })

    it('renders with default height when not specified', () => {
      render(<DocumentTemplateEditor {...defaultProps} />)

      expect(
        document.querySelector('.document-template-editor')
      ).toBeInTheDocument()
    })
  })

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<DocumentTemplateEditor {...defaultProps} className="custom-class" />)

      const container = document.querySelector('.document-template-editor')
      expect(container).toHaveClass('custom-class')
    })
  })
})
