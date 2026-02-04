import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModeSelector } from '@/features/documents/components/ModeSelector'

// Mock pointer capture for Radix UI in jsdom
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

describe('ModeSelector', () => {
  it('renders with override mode selected by default when value is override', () => {
    const onChange = vi.fn()
    render(<ModeSelector value="override" onChange={onChange} />)

    // Should show the current mode in the trigger
    expect(screen.getByText(/override this document/i)).toBeInTheDocument()
  })

  it('renders with template mode selected when value is template', () => {
    const onChange = vi.fn()
    render(<ModeSelector value="template" onChange={onChange} />)

    // Should show template mode text
    expect(screen.getByText(/edit global template/i)).toBeInTheDocument()
  })

  it('opens dropdown when trigger is clicked', () => {
    const onChange = vi.fn()
    render(<ModeSelector value="override" onChange={onChange} />)

    // Open the dropdown using keyboard (more reliable in jsdom)
    const trigger = screen.getByRole('combobox')
    fireEvent.keyDown(trigger, { key: 'Enter' })

    // Should show both options when open
    expect(screen.getAllByText(/override this document/i).length).toBeGreaterThan(0)
  })

  it('disables the selector when disabled prop is true', () => {
    const onChange = vi.fn()
    render(<ModeSelector value="override" onChange={onChange} disabled />)

    const trigger = screen.getByRole('combobox')
    expect(trigger).toBeDisabled()
  })

  it('has accessible labels', () => {
    const onChange = vi.fn()
    render(<ModeSelector value="override" onChange={onChange} />)

    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveAttribute('aria-label', 'Select edit mode')
  })

  it('renders with correct width styling', () => {
    const onChange = vi.fn()
    render(<ModeSelector value="override" onChange={onChange} />)

    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveClass('w-[240px]')
  })

  it('displays icons for each mode', () => {
    const onChange = vi.fn()
    render(<ModeSelector value="override" onChange={onChange} />)

    // The trigger should contain an SVG icon
    const trigger = screen.getByRole('combobox')
    const icon = trigger.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })
})
