import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditorToolbar } from '@/features/documents/components/EditorToolbar'

// Mock pointer capture for Radix UI components
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

describe('EditorToolbar', () => {
  const defaultProps = {
    editMode: 'override' as const,
    onEditModeChange: vi.fn(),
    layout: 'side-by-side' as const,
    onLayoutChange: vi.fn(),
    hasChanges: false,
  }

  it('renders mode selector with current mode', () => {
    render(<EditorToolbar {...defaultProps} />)

    expect(screen.getByText(/override this document/i)).toBeInTheDocument()
  })

  it('renders layout control buttons', () => {
    render(<EditorToolbar {...defaultProps} />)

    // Should have layout buttons
    expect(screen.getByRole('button', { name: /side by side/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /original only/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /output only/i })).toBeInTheDocument()
  })

  it('highlights the active layout button', () => {
    render(<EditorToolbar {...defaultProps} layout="side-by-side" />)

    const sideByButton = screen.getByRole('button', { name: /side by side/i })
    // Active button should have default variant styling
    expect(sideByButton).toHaveAttribute('data-active', 'true')
  })

  it('calls onLayoutChange when layout button is clicked', async () => {
    const onLayoutChange = vi.fn()
    render(<EditorToolbar {...defaultProps} onLayoutChange={onLayoutChange} />)

    const originalOnlyButton = screen.getByRole('button', { name: /original only/i })
    fireEvent.click(originalOnlyButton)

    expect(onLayoutChange).toHaveBeenCalledWith('original-only')
  })

  it('shows save button when hasChanges is true', () => {
    const onSave = vi.fn()
    render(<EditorToolbar {...defaultProps} hasChanges={true} onSave={onSave} />)

    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })

  it('does not show save button when hasChanges is false', () => {
    render(<EditorToolbar {...defaultProps} hasChanges={false} />)

    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
  })

  it('calls onSave when save button is clicked', async () => {
    const onSave = vi.fn()
    render(<EditorToolbar {...defaultProps} hasChanges={true} onSave={onSave} />)

    const saveButton = screen.getByRole('button', { name: /save/i })
    fireEvent.click(saveButton)

    expect(onSave).toHaveBeenCalled()
  })

  it('shows export button when onExport is provided', () => {
    const onExport = vi.fn()
    render(<EditorToolbar {...defaultProps} onExport={onExport} />)

    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
  })

  it('displays template name when provided', () => {
    render(<EditorToolbar {...defaultProps} templateName="Invoice Template" />)

    expect(screen.getByText(/Invoice Template/)).toBeInTheDocument()
  })

  it('shows field count badge when provided', () => {
    render(
      <EditorToolbar
        {...defaultProps}
        fieldCount={{ filled: 5, total: 8 }}
      />
    )

    expect(screen.getByText(/5\/8/)).toBeInTheDocument()
  })

  it('shows override count badge when there are overrides', () => {
    render(<EditorToolbar {...defaultProps} overrideCount={3} />)

    expect(screen.getByText(/3 overrides/i)).toBeInTheDocument()
  })
})
