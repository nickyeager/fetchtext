import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditableVariableBadgeView } from '@/features/documents/components/EditableVariableBadgeView';

describe('EditableVariableBadgeView', () => {
  const defaultProps = {
    variableId: 'vendor_name',
    variableName: 'Vendor Name',
    value: 'Acme Corp',
    originalValue: 'Acme Corp',
    isOverride: false,
    onValueChange: vi.fn().mockResolvedValue(undefined),
    onReset: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('display mode', () => {
    it('renders badge with value when value is provided', () => {
      render(<EditableVariableBadgeView {...defaultProps} />);

      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    it('renders placeholder when value is null', () => {
      render(<EditableVariableBadgeView {...defaultProps} value={null} />);

      expect(screen.getByText(/vendor_name/i)).toBeInTheDocument();
    });

    it('shows checkmark icon when value is present', () => {
      render(<EditableVariableBadgeView {...defaultProps} />);

      expect(screen.getByTestId('value-present-icon')).toBeInTheDocument();
    });

    it('shows alert icon when value is missing', () => {
      render(<EditableVariableBadgeView {...defaultProps} value={null} />);

      expect(screen.getByTestId('value-missing-icon')).toBeInTheDocument();
    });

    it('applies override styling when isOverride is true', () => {
      render(<EditableVariableBadgeView {...defaultProps} isOverride={true} />);

      const badge = screen.getByTestId('variable-badge');
      expect(badge).toHaveClass('border-amber-300');
    });

    it('shows reset button on hover when isOverride is true', async () => {
      const user = userEvent.setup();
      render(<EditableVariableBadgeView {...defaultProps} isOverride={true} />);

      const badge = screen.getByTestId('variable-badge');
      await user.hover(badge);

      const resetButton = screen.getByLabelText('Reset to original');
      // Check it's visible (not hidden with pointer-events-none)
      expect(resetButton).not.toHaveClass('pointer-events-none');
    });
  });

  describe('editing mode', () => {
    it('transforms to input on click', async () => {
      const user = userEvent.setup();
      render(<EditableVariableBadgeView {...defaultProps} />);

      const badge = screen.getByTestId('variable-badge');
      await user.click(badge);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('input is focused and value is selected on click', async () => {
      const user = userEvent.setup();
      render(<EditableVariableBadgeView {...defaultProps} />);

      const badge = screen.getByTestId('variable-badge');
      await user.click(badge);

      const input = screen.getByRole('textbox');
      expect(input).toHaveFocus();
      expect(input).toHaveValue('Acme Corp');
    });

    it('saves value on blur', async () => {
      const user = userEvent.setup();
      const mockOnValueChange = vi.fn().mockResolvedValue(undefined);
      render(
        <EditableVariableBadgeView
          {...defaultProps}
          onValueChange={mockOnValueChange}
        />
      );

      const badge = screen.getByTestId('variable-badge');
      await user.click(badge);

      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'New Value');
      await user.tab(); // Blur

      await waitFor(() => {
        expect(mockOnValueChange).toHaveBeenCalledWith(
          'vendor_name',
          'New Value',
          'Acme Corp'
        );
      });
    });

    it('saves value on Enter key', async () => {
      const user = userEvent.setup();
      const mockOnValueChange = vi.fn().mockResolvedValue(undefined);
      render(
        <EditableVariableBadgeView
          {...defaultProps}
          onValueChange={mockOnValueChange}
        />
      );

      const badge = screen.getByTestId('variable-badge');
      await user.click(badge);

      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'New Value{Enter}');

      await waitFor(() => {
        expect(mockOnValueChange).toHaveBeenCalledWith(
          'vendor_name',
          'New Value',
          'Acme Corp'
        );
      });
    });

    it('cancels edit and reverts on Escape key', async () => {
      const user = userEvent.setup();
      const mockOnValueChange = vi.fn();
      render(
        <EditableVariableBadgeView
          {...defaultProps}
          onValueChange={mockOnValueChange}
        />
      );

      const badge = screen.getByTestId('variable-badge');
      await user.click(badge);

      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'Changed Value');
      await user.keyboard('{Escape}');

      // Should revert to badge mode
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(mockOnValueChange).not.toHaveBeenCalled();
    });

    it('reverts to badge after successful save', async () => {
      const user = userEvent.setup();
      render(<EditableVariableBadgeView {...defaultProps} />);

      const badge = screen.getByTestId('variable-badge');
      await user.click(badge);

      const input = screen.getByRole('textbox');
      await user.type(input, '{Enter}');

      await waitFor(() => {
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      });
    });

    it('does not save if value unchanged', async () => {
      const user = userEvent.setup();
      const mockOnValueChange = vi.fn();
      render(
        <EditableVariableBadgeView
          {...defaultProps}
          onValueChange={mockOnValueChange}
        />
      );

      const badge = screen.getByTestId('variable-badge');
      await user.click(badge);

      const input = screen.getByRole('textbox');
      await user.tab(); // Blur without changing

      expect(mockOnValueChange).not.toHaveBeenCalled();
    });
  });

  describe('reset functionality', () => {
    it('calls onReset when reset button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnReset = vi.fn().mockResolvedValue(undefined);
      render(
        <EditableVariableBadgeView
          {...defaultProps}
          isOverride={true}
          onReset={mockOnReset}
        />
      );

      const badge = screen.getByTestId('variable-badge');
      await user.hover(badge);

      const resetButton = screen.getByLabelText('Reset to original');
      await user.click(resetButton);

      expect(mockOnReset).toHaveBeenCalledWith('vendor_name');
    });

    it('does not show reset button when not an override', () => {
      render(<EditableVariableBadgeView {...defaultProps} isOverride={false} />);

      // Reset button should not be rendered at all when not an override
      expect(screen.queryByLabelText('Reset to original')).not.toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('does not enter edit mode when disabled', async () => {
      const user = userEvent.setup();
      render(<EditableVariableBadgeView {...defaultProps} disabled={true} />);

      const badge = screen.getByTestId('variable-badge');
      await user.click(badge);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('applies disabled styling', () => {
      render(<EditableVariableBadgeView {...defaultProps} disabled={true} />);

      const badge = screen.getByTestId('variable-badge');
      expect(badge).toHaveClass('cursor-not-allowed');
    });
  });
});
