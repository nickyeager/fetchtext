import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FieldOverrideIndicator } from '@/features/documents/components/FieldOverrideIndicator'

describe('FieldOverrideIndicator', () => {
  const defaultProps = {
    fieldName: 'invoice_amount',
    value: '$1,750.00',
    originalValue: '$1,500.00',
    isOverride: true,
    modifiedBy: 'Test User',
    modifiedAt: '2024-01-15T10:30:00Z',
    onReset: vi.fn(),
    onEdit: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('override styling', () => {
    it('should render with amber styling when isOverride is true', () => {
      render(<FieldOverrideIndicator {...defaultProps} />)

      const indicator = screen.getByTestId('field-indicator')
      expect(indicator).toHaveClass('border-amber-300')
      expect(indicator).toHaveClass('border-dotted')
    })

    it('should render with green styling when isOverride is false', () => {
      render(<FieldOverrideIndicator {...defaultProps} isOverride={false} />)

      const indicator = screen.getByTestId('field-indicator')
      expect(indicator).toHaveClass('border-green-300')
      expect(indicator).not.toHaveClass('border-dotted')
    })

    it('should show pencil icon for overrides', () => {
      render(<FieldOverrideIndicator {...defaultProps} />)

      expect(screen.getByTestId('pencil-icon')).toBeInTheDocument()
      expect(screen.queryByTestId('check-icon')).not.toBeInTheDocument()
    })

    it('should show check icon for non-overrides', () => {
      render(<FieldOverrideIndicator {...defaultProps} isOverride={false} />)

      expect(screen.getByTestId('check-icon')).toBeInTheDocument()
      expect(screen.queryByTestId('pencil-icon')).not.toBeInTheDocument()
    })
  })

  describe('value display', () => {
    it('should display the current value', () => {
      render(<FieldOverrideIndicator {...defaultProps} />)

      expect(screen.getByText('$1,750.00')).toBeInTheDocument()
    })

    it('should handle null value gracefully', () => {
      render(<FieldOverrideIndicator {...defaultProps} value={null} />)

      expect(screen.getByText(/no value/i)).toBeInTheDocument()
    })
  })

  describe('reset button', () => {
    it('should show reset button for overrides', () => {
      render(<FieldOverrideIndicator {...defaultProps} />)

      expect(screen.getByLabelText(/reset/i)).toBeInTheDocument()
    })

    it('should not show reset button for non-overrides', () => {
      render(<FieldOverrideIndicator {...defaultProps} isOverride={false} />)

      expect(screen.queryByLabelText(/reset/i)).not.toBeInTheDocument()
    })

    it('should call onReset when reset clicked', async () => {
      const user = userEvent.setup()
      const onReset = vi.fn()
      render(<FieldOverrideIndicator {...defaultProps} onReset={onReset} />)

      await user.click(screen.getByLabelText(/reset/i))

      expect(onReset).toHaveBeenCalledWith('invoice_amount')
    })
  })

  describe('tooltip', () => {
    it('should show tooltip with override details on hover', async () => {
      const user = userEvent.setup()
      render(<FieldOverrideIndicator {...defaultProps} />)

      const indicator = screen.getByTestId('field-indicator')
      await user.hover(indicator)

      // Radix UI tooltips may create duplicate content for accessibility
      const originalValueElements = await screen.findAllByText(/original value/i)
      expect(originalValueElements.length).toBeGreaterThan(0)

      const originalAmountElements = screen.getAllByText('$1,500.00')
      expect(originalAmountElements.length).toBeGreaterThan(0)

      const modifiedByElements = screen.getAllByText(/modified by/i)
      expect(modifiedByElements.length).toBeGreaterThan(0)

      const testUserElements = screen.getAllByText('Test User')
      expect(testUserElements.length).toBeGreaterThan(0)
    })

    it('should show tooltip with confidence for non-overrides', async () => {
      const user = userEvent.setup()
      render(
        <FieldOverrideIndicator
          {...defaultProps}
          isOverride={false}
          confidence={0.95}
        />
      )

      const indicator = screen.getByTestId('field-indicator')
      await user.hover(indicator)

      // Radix UI tooltips may create duplicate content for accessibility
      const confidenceElements = await screen.findAllByText(/95% confidence/i)
      expect(confidenceElements.length).toBeGreaterThan(0)
    })
  })

  describe('double-click to edit', () => {
    it('should call onEdit when double-clicked', async () => {
      const user = userEvent.setup()
      const onEdit = vi.fn()
      render(<FieldOverrideIndicator {...defaultProps} onEdit={onEdit} />)

      const indicator = screen.getByTestId('field-indicator')
      await user.dblClick(indicator)

      expect(onEdit).toHaveBeenCalledWith('invoice_amount', '$1,750.00')
    })

    it('should not call onEdit when readOnly is true', async () => {
      const user = userEvent.setup()
      const onEdit = vi.fn()
      render(<FieldOverrideIndicator {...defaultProps} onEdit={onEdit} readOnly />)

      const indicator = screen.getByTestId('field-indicator')
      await user.dblClick(indicator)

      expect(onEdit).not.toHaveBeenCalled()
    })
  })

  describe('conflict indicator', () => {
    it('should show conflict warning when hasConflict is true', () => {
      render(
        <FieldOverrideIndicator
          {...defaultProps}
          hasConflict
          conflictNewValue="$1,600.00"
        />
      )

      expect(screen.getByTestId('conflict-warning')).toBeInTheDocument()
    })

    it('should pass conflict value to component', () => {
      // Test that conflictNewValue prop is accepted
      render(
        <FieldOverrideIndicator
          {...defaultProps}
          hasConflict
          conflictNewValue="$1,600.00"
        />
      )

      // Conflict warning icon should be visible
      const warning = screen.getByTestId('conflict-warning')
      expect(warning).toHaveClass('text-red-500')
    })
  })

  describe('accessibility', () => {
    it('should have accessible role and label', () => {
      render(<FieldOverrideIndicator {...defaultProps} />)

      // The indicator is a button element with aria-label
      const indicator = screen.getByTestId('field-indicator')
      expect(indicator).toHaveAttribute('aria-label')
      expect(indicator.getAttribute('aria-label')).toContain('invoice_amount')
    })

    it('should announce override status to screen readers', () => {
      render(<FieldOverrideIndicator {...defaultProps} />)

      // Check for screen reader only text
      const srText = document.querySelector('.sr-only')
      expect(srText).toBeInTheDocument()
      expect(srText).toHaveTextContent(/modified from original/i)
    })
  })
})
