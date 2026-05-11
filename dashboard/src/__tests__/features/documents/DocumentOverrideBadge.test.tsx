import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentOverrideBadge } from '@/features/documents/components/DocumentOverrideBadge'

describe('DocumentOverrideBadge', () => {
  describe('visibility', () => {
    it('should not render when overrideCount is 0', () => {
      render(<DocumentOverrideBadge overrideCount={0} />)

      expect(screen.queryByTestId('override-badge')).not.toBeInTheDocument()
    })

    it('should render when overrideCount is greater than 0', () => {
      render(<DocumentOverrideBadge overrideCount={2} />)

      expect(screen.getByTestId('override-badge')).toBeInTheDocument()
    })
  })

  describe('count display', () => {
    it('should display singular "override" for count of 1', () => {
      render(<DocumentOverrideBadge overrideCount={1} />)

      expect(screen.getByText('1 override')).toBeInTheDocument()
    })

    it('should display plural "overrides" for count > 1', () => {
      render(<DocumentOverrideBadge overrideCount={3} />)

      expect(screen.getByText('3 overrides')).toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('should have amber styling', () => {
      render(<DocumentOverrideBadge overrideCount={2} />)

      const badge = screen.getByTestId('override-badge')
      expect(badge).toHaveClass('border-amber-300')
      expect(badge).toHaveClass('bg-amber-50')
      expect(badge).toHaveClass('text-amber-700')
    })

    it('should include pencil icon', () => {
      render(<DocumentOverrideBadge overrideCount={2} />)

      expect(screen.getByTestId('pencil-icon')).toBeInTheDocument()
    })
  })

  describe('conflict indicator', () => {
    it('should not show conflict indicator when hasConflicts is false', () => {
      render(<DocumentOverrideBadge overrideCount={2} hasConflicts={false} />)

      expect(screen.queryByTestId('conflict-dot')).not.toBeInTheDocument()
    })

    it('should show red conflict dot when hasConflicts is true', () => {
      render(<DocumentOverrideBadge overrideCount={2} hasConflicts />)

      const conflictDot = screen.getByTestId('conflict-dot')
      expect(conflictDot).toBeInTheDocument()
      expect(conflictDot).toHaveClass('bg-red-500')
    })
  })

  describe('click interaction', () => {
    it('should call onClick when clicked', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<DocumentOverrideBadge overrideCount={2} onClick={onClick} />)

      await user.click(screen.getByTestId('override-badge'))

      expect(onClick).toHaveBeenCalled()
    })

    it('should have pointer cursor when onClick provided', () => {
      render(<DocumentOverrideBadge overrideCount={2} onClick={() => {}} />)

      const badge = screen.getByTestId('override-badge')
      expect(badge).toHaveClass('cursor-pointer')
    })
  })

  describe('tooltip', () => {
    it('should show tooltip on hover with details', async () => {
      const user = userEvent.setup()
      render(
        <DocumentOverrideBadge
          overrideCount={2}
          fieldOverrideCount={1}
          templateOverride
        />
      )

      await user.hover(screen.getByTestId('override-badge'))

      // Radix UI tooltips may create duplicate content for accessibility
      const fieldOverrideElements = await screen.findAllByText(/1 field override/i)
      expect(fieldOverrideElements.length).toBeGreaterThan(0)

      const templateModifiedElements = screen.getAllByText(/template modified/i)
      expect(templateModifiedElements.length).toBeGreaterThan(0)
    })
  })

  describe('accessibility', () => {
    it('should have accessible label', () => {
      render(<DocumentOverrideBadge overrideCount={2} />)

      expect(screen.getByRole('status', { name: /document has 2 overrides/i })).toBeInTheDocument()
    })
  })
})
