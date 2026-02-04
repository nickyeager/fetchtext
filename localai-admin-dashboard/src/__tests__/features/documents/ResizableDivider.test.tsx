import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResizableDivider } from '@/features/documents/components/ResizableDivider'

describe('ResizableDivider', () => {
  it('renders a drag handle with grip icon', () => {
    const onDrag = vi.fn()
    render(<ResizableDivider onDrag={onDrag} />)

    // Should render the divider container
    const divider = screen.getByRole('separator')
    expect(divider).toBeInTheDocument()

    // Should have cursor-col-resize class for horizontal drag
    expect(divider).toHaveClass('cursor-col-resize')
  })

  it('calls onDrag when mouse down is triggered', () => {
    const onDrag = vi.fn()
    render(<ResizableDivider onDrag={onDrag} />)

    const divider = screen.getByRole('separator')
    fireEvent.mouseDown(divider, { clientX: 100 })

    expect(onDrag).toHaveBeenCalledTimes(1)
    expect(onDrag).toHaveBeenCalledWith(expect.objectContaining({
      clientX: 100
    }))
  })

  it('applies custom className when provided', () => {
    const onDrag = vi.fn()
    render(<ResizableDivider onDrag={onDrag} className="custom-class" />)

    const divider = screen.getByRole('separator')
    expect(divider).toHaveClass('custom-class')
  })

  it('has visual feedback styles for hover', () => {
    const onDrag = vi.fn()
    render(<ResizableDivider onDrag={onDrag} />)

    const divider = screen.getByRole('separator')
    // Should have hover styles defined
    expect(divider).toHaveClass('hover:bg-primary/50')
  })

  it('renders grip icon for visual affordance', () => {
    const onDrag = vi.fn()
    render(<ResizableDivider onDrag={onDrag} />)

    // The grip icon should be present (lucide-react renders as svg)
    const icon = screen.getByRole('separator').querySelector('svg')
    expect(icon).toBeInTheDocument()
  })

  it('is accessible with proper ARIA attributes', () => {
    const onDrag = vi.fn()
    render(<ResizableDivider onDrag={onDrag} />)

    const divider = screen.getByRole('separator')
    // Should have aria-label for screen readers
    expect(divider).toHaveAttribute('aria-label', 'Resize panels')
    // Should have aria-orientation
    expect(divider).toHaveAttribute('aria-orientation', 'vertical')
  })
})
