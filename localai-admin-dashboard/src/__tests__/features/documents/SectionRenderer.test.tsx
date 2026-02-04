import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectionRenderer } from '@/features/documents/components/SectionRenderer'

// Mock pointer capture for Radix UI components
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

describe('SectionRenderer', () => {
  const defaultProps = {
    content: 'Hello {{name}}, your order is {{order_id}}.',
    extractedFields: {
      name: { value: 'John', confidence: 0.95 },
      order_id: { value: 'ORD-123', confidence: 0.88 },
    },
    editingSectionId: null,
    editMode: 'override' as const,
    onSectionEdit: vi.fn(),
    onSectionSave: vi.fn(),
    onSectionCancel: vi.fn(),
  }

  it('renders text sections and variable placeholders', () => {
    render(<SectionRenderer {...defaultProps} />)

    // Should render the text parts
    expect(screen.getByText(/Hello/)).toBeInTheDocument()
    expect(screen.getByText(/your order is/)).toBeInTheDocument()

    // Should render the extracted field values
    expect(screen.getByText('John')).toBeInTheDocument()
    expect(screen.getByText('ORD-123')).toBeInTheDocument()
  })

  it('renders variable badges with values', () => {
    render(<SectionRenderer {...defaultProps} />)

    // Variables should be rendered with their values
    const johnBadge = screen.getByText('John')
    expect(johnBadge).toBeInTheDocument()
  })

  it('renders placeholder for missing variable values', () => {
    const props = {
      ...defaultProps,
      extractedFields: {
        name: { value: null, confidence: 0 },
      },
    }
    render(<SectionRenderer {...props} />)

    // Should show the variable name as placeholder when no value
    expect(screen.getByText(/\{\{name\}\}/)).toBeInTheDocument()
  })

  it('makes text sections clickable when enableSectionEditing is true', () => {
    render(<SectionRenderer {...defaultProps} enableSectionEditing={true} />)

    // Text sections should have role="button" for clickability
    const textSection = screen.getByText(/Hello/)
    expect(textSection).toHaveAttribute('role', 'button')
  })

  it('shows inline editor for the section being edited', () => {
    const props = {
      ...defaultProps,
      enableSectionEditing: true,
      editingSectionId: 'text-0',
    }
    render(<SectionRenderer {...props} />)

    // Should show a textarea for the editing section
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('applies override styling to sections with overrides', () => {
    const props = {
      ...defaultProps,
      sectionOverrides: {
        'text-0': {
          value: 'Updated Hello',
          original_value: 'Hello ',
          modified_at: new Date().toISOString(),
        },
      },
    }
    render(<SectionRenderer {...props} />)

    // Should show the overridden value
    expect(screen.getByText(/Updated Hello/)).toBeInTheDocument()
  })

  it('calls onSectionEdit when a text section is clicked', async () => {
    const onSectionEdit = vi.fn()
    render(
      <SectionRenderer
        {...defaultProps}
        enableSectionEditing={true}
        onSectionEdit={onSectionEdit}
      />
    )

    const textSection = screen.getByText(/Hello/)
    textSection.click()

    expect(onSectionEdit).toHaveBeenCalledWith('text-0')
  })

  it('does not allow editing when readOnly is true', () => {
    render(
      <SectionRenderer
        {...defaultProps}
        enableSectionEditing={true}
        readOnly={true}
      />
    )

    // Text sections should not have button role when read-only
    const textSection = screen.getByText(/Hello/)
    expect(textSection).not.toHaveAttribute('role', 'button')
  })

  it('passes field overrides to variable badges', () => {
    const props = {
      ...defaultProps,
      fieldOverrides: {
        name: {
          value: 'Jane',
          original_value: 'John',
          modified_at: new Date().toISOString(),
          modified_by: 'user-1',
        },
      },
      enableOverrides: true,
    }
    render(<SectionRenderer {...props} />)

    // Should show the overridden field value
    expect(screen.getByText('Jane')).toBeInTheDocument()
  })

  it('parses content correctly with multiple variables', () => {
    const props = {
      ...defaultProps,
      content: '{{greeting}} {{name}}! Your {{item}} costs {{price}}.',
      extractedFields: {
        greeting: { value: 'Hi', confidence: 0.9 },
        name: { value: 'Alice', confidence: 0.95 },
        item: { value: 'Widget', confidence: 0.85 },
        price: { value: '$19.99', confidence: 0.92 },
      },
    }
    render(<SectionRenderer {...props} />)

    expect(screen.getByText('Hi')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Widget')).toBeInTheDocument()
    expect(screen.getByText('$19.99')).toBeInTheDocument()
  })
})
