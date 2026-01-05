import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SplitPanelContainer } from '@/features/documents/components/SplitPanelContainer'

describe('SplitPanelContainer', () => {
  const defaultProps = {
    layout: 'side-by-side' as const,
    leftPanel: <div data-testid="left-panel">Left Content</div>,
    rightPanel: <div data-testid="right-panel">Right Content</div>,
  }

  it('renders both panels in side-by-side mode', () => {
    render(<SplitPanelContainer {...defaultProps} />)

    expect(screen.getByTestId('left-panel')).toBeInTheDocument()
    expect(screen.getByTestId('right-panel')).toBeInTheDocument()
  })

  it('shows only left panel in original-only mode', () => {
    render(<SplitPanelContainer {...defaultProps} layout="original-only" />)

    expect(screen.getByTestId('left-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('right-panel')).not.toBeInTheDocument()
  })

  it('shows only right panel in output-only mode', () => {
    render(<SplitPanelContainer {...defaultProps} layout="output-only" />)

    expect(screen.queryByTestId('left-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('right-panel')).toBeInTheDocument()
  })

  it('renders resizable divider in side-by-side mode', () => {
    render(<SplitPanelContainer {...defaultProps} />)

    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('does not render divider in single panel modes', () => {
    render(<SplitPanelContainer {...defaultProps} layout="original-only" />)

    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })

  it('has correct initial split ratio of 50%', () => {
    render(<SplitPanelContainer {...defaultProps} />)

    const leftContainer = screen.getByTestId('left-panel').parentElement
    // Should have width of approximately 50%
    expect(leftContainer).toHaveStyle({ width: '50%' })
  })

  it('maintains flexbox layout for side-by-side', () => {
    const { container } = render(<SplitPanelContainer {...defaultProps} />)

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('flex')
  })

  it('applies custom className', () => {
    const { container } = render(
      <SplitPanelContainer {...defaultProps} className="custom-class" />
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('custom-class')
  })

  it('handles drag events on divider', () => {
    render(<SplitPanelContainer {...defaultProps} />)

    const divider = screen.getByRole('separator')

    // Simulate drag start
    fireEvent.mouseDown(divider, { clientX: 500 })

    // Should respond to mouse down (no crash)
    expect(divider).toBeInTheDocument()
  })
})
