import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OverrideManagementPanel } from '@/features/documents/components/OverrideManagementPanel'
import { DocumentOverrides } from '@/services/document-override-service'

describe('OverrideManagementPanel', () => {
  const mockOverrides: DocumentOverrides = {
    has_overrides: true,
    overrides_modified_at: '2024-01-15T10:30:00Z',
    overrides_modified_by: 'user-123',
    field_overrides: {
      invoice_amount: {
        value: '$1,750.00',
        original_value: '$1,500.00',
        modified_at: '2024-01-15T10:30:00Z',
        modified_by: 'user-123',
        modified_by_name: 'John Doe',
        override_reason: 'manual_edit',
      },
      client_name: {
        value: 'John A. Smith',
        original_value: 'John Smith',
        modified_at: '2024-01-15T11:00:00Z',
        modified_by: 'user-456',
        modified_by_name: 'Jane Doe',
        override_reason: 'correction',
      },
    },
    template_content_override: {
      content: 'Modified template content',
      original_content: 'Original template content',
      source_template_id: 42,
      source_template_version: '2024-01-01T00:00:00Z',
      modified_at: '2024-01-15T12:00:00Z',
      modified_by: 'user-123',
      modified_by_name: 'John Doe',
    },
  }

  const defaultProps = {
    overrides: mockOverrides,
    onResetField: vi.fn(),
    onResetAll: vi.fn(),
    onResetTemplateContent: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render panel header with summary', () => {
      render(<OverrideManagementPanel {...defaultProps} />)

      expect(screen.getByText(/document overrides/i)).toBeInTheDocument()
      expect(screen.getByText(/2 field overrides/i)).toBeInTheDocument()
      expect(screen.getByText(/1 template change/i)).toBeInTheDocument()
    })

    it('should not render when no overrides', () => {
      const noOverrides: DocumentOverrides = {
        has_overrides: false,
        field_overrides: {},
      }

      render(<OverrideManagementPanel {...defaultProps} overrides={noOverrides} />)

      expect(screen.queryByText(/document overrides/i)).not.toBeInTheDocument()
    })
  })

  describe('field override list', () => {
    it('should list all field overrides with before/after values', () => {
      render(<OverrideManagementPanel {...defaultProps} />)

      // First field - check field name and values
      expect(screen.getByText('invoice_amount')).toBeInTheDocument()
      expect(screen.getByText('$1,500.00')).toBeInTheDocument()
      expect(screen.getByText('$1,750.00')).toBeInTheDocument()
      // Arrow is an SVG icon, not text

      // Second field
      expect(screen.getByText('client_name')).toBeInTheDocument()
      expect(screen.getByText('John Smith')).toBeInTheDocument()
      expect(screen.getByText('John A. Smith')).toBeInTheDocument()
    })

    it('should show who modified each field', () => {
      render(<OverrideManagementPanel {...defaultProps} />)

      // John Doe appears twice (field override + template override)
      const johnDoes = screen.getAllByText(/john doe/i)
      expect(johnDoes.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/jane doe/i)).toBeInTheDocument()
    })

    it('should have reset button for each field', () => {
      render(<OverrideManagementPanel {...defaultProps} />)

      const resetButtons = screen.getAllByRole('button', { name: /reset/i })
      // 2 for fields, 1 for template, 1 for reset all
      expect(resetButtons.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('template content override', () => {
    it('should show template modification section', () => {
      render(<OverrideManagementPanel {...defaultProps} />)

      expect(screen.getByText(/template content modified/i)).toBeInTheDocument()
    })

    it('should show compare/diff button for template when onCompareTemplate provided', () => {
      const onCompareTemplate = vi.fn()
      render(<OverrideManagementPanel {...defaultProps} onCompareTemplate={onCompareTemplate} />)

      expect(screen.getByRole('button', { name: /compare/i })).toBeInTheDocument()
    })

    it('should not show template section when no template override', () => {
      const noTemplateOverride: DocumentOverrides = {
        ...mockOverrides,
        template_content_override: undefined,
      }

      render(<OverrideManagementPanel {...defaultProps} overrides={noTemplateOverride} />)

      expect(screen.queryByText(/template content modified/i)).not.toBeInTheDocument()
    })
  })

  describe('reset interactions', () => {
    it('should call onResetField when field reset confirmed', async () => {
      const user = userEvent.setup()
      const onResetField = vi.fn()
      render(<OverrideManagementPanel {...defaultProps} onResetField={onResetField} />)

      // Find the row for invoice_amount and click its reset button
      const row = screen.getByText('invoice_amount').closest('[data-testid="override-row"]')
      const resetButton = within(row!).getByRole('button', { name: /reset/i })
      await user.click(resetButton)

      // Wait for dialog and confirm - AlertDialogAction renders with destructive styling
      await screen.findByRole('alertdialog')
      const allButtons = screen.getAllByRole('button')
      const confirmBtn = allButtons.find(b => b.textContent?.trim() === 'Reset' && b.className.includes('bg-red'))
      await user.click(confirmBtn!)

      expect(onResetField).toHaveBeenCalledWith('invoice_amount')
    })

    it('should call onResetTemplateContent when template reset confirmed', async () => {
      const user = userEvent.setup()
      const onResetTemplateContent = vi.fn()
      render(
        <OverrideManagementPanel
          {...defaultProps}
          onResetTemplateContent={onResetTemplateContent}
        />
      )

      // Find the template reset button by aria-label
      const templateResetBtn = screen.getByRole('button', { name: /reset template to original/i })
      await user.click(templateResetBtn)

      // Wait for dialog and confirm
      await screen.findByRole('alertdialog')
      const allButtons = screen.getAllByRole('button')
      const confirmBtn = allButtons.find(b => b.textContent?.trim() === 'Reset' && b.className.includes('bg-red'))
      await user.click(confirmBtn!)

      expect(onResetTemplateContent).toHaveBeenCalled()
    })

    it('should call onResetAll when Reset All confirmed', async () => {
      const user = userEvent.setup()
      const onResetAll = vi.fn()
      render(<OverrideManagementPanel {...defaultProps} onResetAll={onResetAll} />)

      await user.click(screen.getByRole('button', { name: /reset all/i }))

      // Wait for dialog and confirm
      await screen.findByRole('alertdialog')
      const allButtons = screen.getAllByRole('button')
      const confirmBtn = allButtons.find(b => b.textContent?.trim() === 'Reset' && b.className.includes('bg-red'))
      await user.click(confirmBtn!)

      expect(onResetAll).toHaveBeenCalled()
    })
  })

  describe('confirmation dialogs', () => {
    it('should show confirmation before resetting field', async () => {
      const user = userEvent.setup()
      render(<OverrideManagementPanel {...defaultProps} />)

      const row = screen.getByText('invoice_amount').closest('[data-testid="override-row"]')
      const resetButton = within(row!).getByRole('button', { name: /reset/i })
      await user.click(resetButton)

      expect(await screen.findByText(/reset to original value/i)).toBeInTheDocument()
      // The dialog should contain the original value
      expect(screen.getAllByText(/\$1,500\.00/).length).toBeGreaterThanOrEqual(1)
    })

    it('should show confirmation before resetting all', async () => {
      const user = userEvent.setup()
      render(<OverrideManagementPanel {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /reset all/i }))

      expect(await screen.findByText(/reset 3 overrides/i)).toBeInTheDocument()
    })

    it('should cancel reset when dialog cancelled', async () => {
      const user = userEvent.setup()
      const onResetAll = vi.fn()
      render(<OverrideManagementPanel {...defaultProps} onResetAll={onResetAll} />)

      await user.click(screen.getByRole('button', { name: /reset all/i }))
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(onResetAll).not.toHaveBeenCalled()
    })
  })

  describe('collapsible behavior', () => {
    it('should be collapsed by default when defaultCollapsed is true', () => {
      render(<OverrideManagementPanel {...defaultProps} defaultCollapsed />)

      // When collapsed, the content is not rendered
      expect(screen.queryByTestId('override-row')).not.toBeInTheDocument()
    })

    it('should expand when header clicked', async () => {
      const user = userEvent.setup()
      render(<OverrideManagementPanel {...defaultProps} defaultCollapsed />)

      await user.click(screen.getByText(/document overrides/i))

      expect(screen.getByText('invoice_amount')).toBeInTheDocument()
    })

    it('should collapse when header clicked again', async () => {
      const user = userEvent.setup()
      render(<OverrideManagementPanel {...defaultProps} />)

      // Initially expanded
      expect(screen.getByText('invoice_amount')).toBeInTheDocument()

      // Click to collapse
      await user.click(screen.getByText(/document overrides/i))

      // Content should be hidden
      expect(screen.queryByTestId('override-row')).not.toBeInTheDocument()
    })
  })

  describe('conflict display', () => {
    it('should highlight conflicting overrides', () => {
      const withConflicts: DocumentOverrides = {
        ...mockOverrides,
        field_overrides: {
          ...mockOverrides.field_overrides,
          invoice_amount: {
            ...mockOverrides.field_overrides!.invoice_amount,
            has_conflict: true,
            conflict_new_value: '$1,600.00',
          },
        },
      }

      render(<OverrideManagementPanel {...defaultProps} overrides={withConflicts} />)

      const row = screen.getByText('invoice_amount').closest('[data-testid="override-row"]')
      expect(row).toHaveClass('border-red-200')
    })

    it('should show re-extracted value in conflict warning', () => {
      const withConflicts: DocumentOverrides = {
        ...mockOverrides,
        field_overrides: {
          ...mockOverrides.field_overrides,
          invoice_amount: {
            ...mockOverrides.field_overrides!.invoice_amount,
            has_conflict: true,
            conflict_new_value: '$1,600.00',
          },
        },
      }

      render(<OverrideManagementPanel {...defaultProps} overrides={withConflicts} />)

      expect(screen.getByText(/new extracted: \$1,600\.00/i)).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have accessible panel structure', () => {
      render(<OverrideManagementPanel {...defaultProps} />)

      expect(screen.getByRole('region', { name: /document overrides/i })).toBeInTheDocument()
    })

    it('should have accessible expand/collapse control', () => {
      render(<OverrideManagementPanel {...defaultProps} />)

      const trigger = screen.getByRole('button', { name: /collapse|expand/i })
      expect(trigger).toHaveAttribute('aria-expanded')
    })
  })
})
