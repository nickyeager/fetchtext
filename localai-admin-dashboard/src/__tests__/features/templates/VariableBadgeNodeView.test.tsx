/**
 * VariableBadgeNodeView Tests
 *
 * Tests for the TipTap node view that renders variable badges.
 * Covers both display mode (existing) and value editing mode (new).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VariableBadgeNodeView } from '@/features/templates/components/VariableBadgeNodeView'

// Create mock NodeViewProps
const createMockProps = (overrides: Record<string, any> = {}) => ({
  node: {
    attrs: {
      variableId: 'vendor_name',
      variableName: 'Vendor Name',
      format: 'raw',
      ...overrides.attrs,
    },
  },
  selected: false,
  extension: {
    options: {
      extractedData: { vendor_name: 'Acme Corp' },
      onVariableClick: vi.fn(),
      enableValueEditing: false,
      fieldOverrides: {},
      onValueChange: vi.fn().mockResolvedValue(undefined),
      onResetOverride: vi.fn().mockResolvedValue(undefined),
      ...overrides.options,
    },
  },
  getPos: vi.fn(() => 0),
  updateAttributes: vi.fn(),
  deleteNode: vi.fn(),
  editor: {} as any,
  ...overrides,
})

describe('VariableBadgeNodeView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('display mode (existing behavior)', () => {
    it('renders variable name with mustache syntax', () => {
      const props = createMockProps()
      render(<VariableBadgeNodeView {...props} />)

      expect(screen.getByText('Vendor Name')).toBeInTheDocument()
      // Check for mustache braces
      expect(screen.getAllByText('{')).toHaveLength(2)
      expect(screen.getAllByText('}')).toHaveLength(2)
    })

    it('calls onVariableClick when clicked', async () => {
      const user = userEvent.setup()
      const mockOnClick = vi.fn()
      const props = createMockProps({
        options: { onVariableClick: mockOnClick },
      })
      render(<VariableBadgeNodeView {...props} />)

      const button = screen.getByRole('button')
      await user.click(button)

      expect(mockOnClick).toHaveBeenCalledWith('vendor_name')
    })

    it('shows selected styling when selected', () => {
      const props = createMockProps({ selected: true })
      render(<VariableBadgeNodeView {...props} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('ring-2')
    })
  })

  describe('value editing mode', () => {
    it('renders EditableVariableBadgeView when enableValueEditing is true', () => {
      const props = createMockProps({
        options: { enableValueEditing: true },
      })
      render(<VariableBadgeNodeView {...props} />)

      // Should show extracted value, not mustache syntax
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
      // Should have the editable badge test id
      expect(screen.getByTestId('variable-badge')).toBeInTheDocument()
    })

    it('shows placeholder when value is not extracted', () => {
      const props = createMockProps({
        options: {
          enableValueEditing: true,
          extractedData: {},
        },
      })
      render(<VariableBadgeNodeView {...props} />)

      // Should show placeholder with variable ID
      expect(screen.getByText(/vendor_name/i)).toBeInTheDocument()
    })

    it('transforms to input on click in editing mode', async () => {
      const user = userEvent.setup()
      const props = createMockProps({
        options: { enableValueEditing: true },
      })
      render(<VariableBadgeNodeView {...props} />)

      const badge = screen.getByTestId('variable-badge')
      await user.click(badge)

      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toHaveValue('Acme Corp')
    })

    it('calls onValueChange when value is edited', async () => {
      const user = userEvent.setup()
      const mockOnValueChange = vi.fn().mockResolvedValue(undefined)
      const props = createMockProps({
        options: {
          enableValueEditing: true,
          onValueChange: mockOnValueChange,
        },
      })
      render(<VariableBadgeNodeView {...props} />)

      const badge = screen.getByTestId('variable-badge')
      await user.click(badge)

      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, 'New Value{Enter}')

      await waitFor(() => {
        expect(mockOnValueChange).toHaveBeenCalledWith(
          'vendor_name',
          'New Value',
          'Acme Corp'
        )
      })
    })

    it('shows override styling when field has override', () => {
      const props = createMockProps({
        options: {
          enableValueEditing: true,
          extractedData: { vendor_name: 'Original Value' },
          fieldOverrides: {
            vendor_name: {
              value: 'Override Value',
              original_value: 'Original Value',
              modified_at: new Date().toISOString(),
            },
          },
        },
      })
      render(<VariableBadgeNodeView {...props} />)

      // Should show override value
      expect(screen.getByText('Override Value')).toBeInTheDocument()
      // Should have override styling
      const badge = screen.getByTestId('variable-badge')
      expect(badge).toHaveClass('border-amber-300')
    })

    it('shows reset button on hover when field has override', async () => {
      const user = userEvent.setup()
      const props = createMockProps({
        options: {
          enableValueEditing: true,
          extractedData: { vendor_name: 'Original Value' },
          fieldOverrides: {
            vendor_name: {
              value: 'Override Value',
              original_value: 'Original Value',
              modified_at: new Date().toISOString(),
            },
          },
        },
      })
      render(<VariableBadgeNodeView {...props} />)

      const badge = screen.getByTestId('variable-badge')
      await user.hover(badge)

      const resetButton = screen.getByLabelText('Reset to original')
      expect(resetButton).not.toHaveClass('pointer-events-none')
    })

    it('calls onResetOverride when reset button is clicked', async () => {
      const user = userEvent.setup()
      const mockOnReset = vi.fn().mockResolvedValue(undefined)
      const props = createMockProps({
        options: {
          enableValueEditing: true,
          extractedData: { vendor_name: 'Original Value' },
          fieldOverrides: {
            vendor_name: {
              value: 'Override Value',
              original_value: 'Original Value',
              modified_at: new Date().toISOString(),
            },
          },
          onResetOverride: mockOnReset,
        },
      })
      render(<VariableBadgeNodeView {...props} />)

      const badge = screen.getByTestId('variable-badge')
      await user.hover(badge)

      const resetButton = screen.getByLabelText('Reset to original')
      await user.click(resetButton)

      expect(mockOnReset).toHaveBeenCalledWith('vendor_name')
    })

    it('falls back to display mode when enableValueEditing is false', () => {
      const props = createMockProps({
        options: {
          enableValueEditing: false,
          extractedData: { vendor_name: 'Acme Corp' },
        },
      })
      render(<VariableBadgeNodeView {...props} />)

      // Should show mustache syntax, not value
      expect(screen.getByText('Vendor Name')).toBeInTheDocument()
      // Should NOT have editable badge
      expect(screen.queryByTestId('variable-badge')).not.toBeInTheDocument()
    })
  })
})
