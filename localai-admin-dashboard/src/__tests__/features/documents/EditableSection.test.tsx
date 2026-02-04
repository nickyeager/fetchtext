import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditableSection } from '@/features/documents/components/EditableSection'

// Mock pointer capture for Radix UI components
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

describe('EditableSection', () => {
  const defaultProps = {
    sectionId: 'section-1',
    content: 'This is some text content.',
    isEditing: false,
    onEdit: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    editMode: 'override' as const,
  }

  it('renders text content in read mode', () => {
    render(<EditableSection {...defaultProps} />)

    expect(screen.getByText('This is some text content.')).toBeInTheDocument()
  })

  it('calls onEdit when clicked in read mode', async () => {
    const onEdit = vi.fn()
    render(<EditableSection {...defaultProps} onEdit={onEdit} />)

    const section = screen.getByText('This is some text content.')
    await userEvent.click(section)

    expect(onEdit).toHaveBeenCalledWith('section-1')
  })

  it('does not call onEdit when readOnly is true', async () => {
    const onEdit = vi.fn()
    render(<EditableSection {...defaultProps} onEdit={onEdit} readOnly />)

    const section = screen.getByText('This is some text content.')
    await userEvent.click(section)

    expect(onEdit).not.toHaveBeenCalled()
  })

  it('shows editor when isEditing is true', () => {
    render(<EditableSection {...defaultProps} isEditing={true} />)

    // Should show an input/textarea for editing
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('This is some text content.')
  })

  it('shows save and cancel buttons when editing', () => {
    render(<EditableSection {...defaultProps} isEditing={true} />)

    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('calls onSave with new content when save is clicked', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<EditableSection {...defaultProps} isEditing={true} onSave={onSave} />)

    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'Updated content')

    const saveButton = screen.getByRole('button', { name: /save/i })
    await userEvent.click(saveButton)

    expect(onSave).toHaveBeenCalledWith('section-1', 'Updated content')
  })

  it('calls onCancel when cancel is clicked', async () => {
    const onCancel = vi.fn()
    render(<EditableSection {...defaultProps} isEditing={true} onCancel={onCancel} />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await userEvent.click(cancelButton)

    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onCancel when Escape is pressed', async () => {
    const onCancel = vi.fn()
    render(<EditableSection {...defaultProps} isEditing={true} onCancel={onCancel} />)

    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onCancel).toHaveBeenCalled()
  })

  it('shows override styling when isOverride is true', () => {
    render(<EditableSection {...defaultProps} isOverride={true} />)

    const section = screen.getByText('This is some text content.')
    // Should have amber/override styling
    expect(section.className).toMatch(/amber|override/)
  })

  it('shows hover styling on mouse over', async () => {
    render(<EditableSection {...defaultProps} />)

    const section = screen.getByText('This is some text content.')
    // Should have hover class
    expect(section.className).toMatch(/hover/)
  })

  it('has accessible role for interactive element', () => {
    render(<EditableSection {...defaultProps} />)

    const section = screen.getByText('This is some text content.')
    expect(section).toHaveAttribute('role', 'button')
  })

  it('shows reset button when isOverride is true and onReset is provided', () => {
    const onReset = vi.fn()
    render(
      <EditableSection
        {...defaultProps}
        isOverride={true}
        onReset={onReset}
      />
    )

    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
  })

  it('calls onReset when reset button is clicked', async () => {
    const onReset = vi.fn()
    render(
      <EditableSection
        {...defaultProps}
        isOverride={true}
        onReset={onReset}
      />
    )

    const resetButton = screen.getByRole('button', { name: /reset/i })
    await userEvent.click(resetButton)

    expect(onReset).toHaveBeenCalledWith('section-1')
  })
})
