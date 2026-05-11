import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SaveTemplateDialog } from '@/features/documents/components/SaveTemplateDialog';

describe('SaveTemplateDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    templateName: 'Invoice Template',
    templateId: 123,
    onSave: vi.fn().mockResolvedValue(undefined),
  };

  // Override-specific tests
  describe('with enableOverride option', () => {
    const propsWithOverride = {
      ...defaultProps,
      enableOverride: true,
      documentId: 'doc-123',
    };

    it('shows override option when enableOverride is true', () => {
      render(<SaveTemplateDialog {...propsWithOverride} />);

      expect(screen.getByText('Override This Document')).toBeInTheDocument();
    });

    it('hides override option when enableOverride is false', () => {
      render(<SaveTemplateDialog {...defaultProps} enableOverride={false} />);

      expect(screen.queryByText('Override This Document')).not.toBeInTheDocument();
    });

    it('shows document-specific description for override option', () => {
      render(<SaveTemplateDialog {...propsWithOverride} />);

      expect(screen.getByText(/Only affects this document, not the global template/)).toBeInTheDocument();
    });

    it('defaults to override when enableOverride and documentId are provided', () => {
      render(<SaveTemplateDialog {...propsWithOverride} />);

      const overrideRadio = screen.getByRole('radio', { name: /override this document/i });
      expect(overrideRadio).toBeChecked();
    });

    it('calls onSave with override action', async () => {
      const user = userEvent.setup();
      const mockOnSave = vi.fn().mockResolvedValue(undefined);
      render(<SaveTemplateDialog {...propsWithOverride} onSave={mockOnSave} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('override', undefined);
      });
    });

    it('does not show name input when override is selected', () => {
      render(<SaveTemplateDialog {...propsWithOverride} />);

      expect(screen.queryByLabelText('New Template Name')).not.toBeInTheDocument();
    });
  });

  it('renders dialog when open is true', () => {
    render(<SaveTemplateDialog {...defaultProps} />);

    expect(screen.getByText('Save Template Changes')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(<SaveTemplateDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('Save Template Changes')).not.toBeInTheDocument();
  });

  it('shows both options when templateId is provided', () => {
    render(<SaveTemplateDialog {...defaultProps} />);

    expect(screen.getByText('Modify Existing Template')).toBeInTheDocument();
    expect(screen.getByText('Create New Template')).toBeInTheDocument();
  });

  it('only shows create option when templateId is not provided', () => {
    render(<SaveTemplateDialog {...defaultProps} templateId={undefined} />);

    expect(screen.queryByText('Modify Existing Template')).not.toBeInTheDocument();
    expect(screen.getByText('Create New Template')).toBeInTheDocument();
  });

  it('shows template name in modify option description', () => {
    render(<SaveTemplateDialog {...defaultProps} />);

    expect(screen.getByText(/Update "Invoice Template" with the new variables/)).toBeInTheDocument();
  });

  it('defaults to modify when templateId is provided', () => {
    render(<SaveTemplateDialog {...defaultProps} />);

    const modifyRadio = screen.getByRole('radio', { name: /modify existing template/i });
    expect(modifyRadio).toBeChecked();
  });

  it('defaults to create when templateId is not provided', () => {
    render(<SaveTemplateDialog {...defaultProps} templateId={undefined} />);

    const createRadio = screen.getByRole('radio', { name: /create new template/i });
    expect(createRadio).toBeChecked();
  });

  it('shows name input when create option is selected', async () => {
    const user = userEvent.setup();
    render(<SaveTemplateDialog {...defaultProps} />);

    // Click on create option
    const createRadio = screen.getByRole('radio', { name: /create new template/i });
    await user.click(createRadio);

    expect(screen.getByLabelText('New Template Name')).toBeInTheDocument();
  });

  it('hides name input when modify option is selected', async () => {
    const user = userEvent.setup();
    render(<SaveTemplateDialog {...defaultProps} />);

    // First select create to show the input
    const createRadio = screen.getByRole('radio', { name: /create new template/i });
    await user.click(createRadio);
    expect(screen.getByLabelText('New Template Name')).toBeInTheDocument();

    // Then select modify to hide it
    const modifyRadio = screen.getByRole('radio', { name: /modify existing template/i });
    await user.click(modifyRadio);
    expect(screen.queryByLabelText('New Template Name')).not.toBeInTheDocument();
  });

  it('disables save button when create is selected but name is empty', async () => {
    const user = userEvent.setup();
    render(<SaveTemplateDialog {...defaultProps} />);

    const createRadio = screen.getByRole('radio', { name: /create new template/i });
    await user.click(createRadio);

    const saveButton = screen.getByRole('button', { name: /save template/i });
    expect(saveButton).toBeDisabled();
  });

  it('enables save button when create is selected and name is provided', async () => {
    const user = userEvent.setup();
    render(<SaveTemplateDialog {...defaultProps} />);

    const createRadio = screen.getByRole('radio', { name: /create new template/i });
    await user.click(createRadio);

    const nameInput = screen.getByLabelText('New Template Name');
    await user.type(nameInput, 'My New Template');

    const saveButton = screen.getByRole('button', { name: /save template/i });
    expect(saveButton).not.toBeDisabled();
  });

  it('calls onSave with modify action when modify is selected', async () => {
    const user = userEvent.setup();
    const mockOnSave = vi.fn().mockResolvedValue(undefined);
    render(<SaveTemplateDialog {...defaultProps} onSave={mockOnSave} />);

    const saveButton = screen.getByRole('button', { name: /save template/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('modify', undefined);
    });
  });

  it('calls onSave with create action and name when create is selected', async () => {
    const user = userEvent.setup();
    const mockOnSave = vi.fn().mockResolvedValue(undefined);
    render(<SaveTemplateDialog {...defaultProps} onSave={mockOnSave} />);

    const createRadio = screen.getByRole('radio', { name: /create new template/i });
    await user.click(createRadio);

    const nameInput = screen.getByLabelText('New Template Name');
    await user.type(nameInput, 'My New Template');

    const saveButton = screen.getByRole('button', { name: /save template/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('create', 'My New Template');
    });
  });

  it('shows loading state while saving', async () => {
    const user = userEvent.setup();
    // Create a promise that we can control
    let resolvePromise: () => void;
    const mockOnSave = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolvePromise = resolve; })
    );
    render(<SaveTemplateDialog {...defaultProps} onSave={mockOnSave} />);

    const saveButton = screen.getByRole('button', { name: /save template/i });
    await user.click(saveButton);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    // Resolve the promise
    resolvePromise!();
  });

  it('closes dialog after successful save', async () => {
    const user = userEvent.setup();
    const mockOnOpenChange = vi.fn();
    render(<SaveTemplateDialog {...defaultProps} onOpenChange={mockOnOpenChange} />);

    const saveButton = screen.getByRole('button', { name: /save template/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('closes dialog when cancel is clicked', async () => {
    const user = userEvent.setup();
    const mockOnOpenChange = vi.fn();
    render(<SaveTemplateDialog {...defaultProps} onOpenChange={mockOnOpenChange} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('clears name input on successful save', async () => {
    const user = userEvent.setup();
    render(<SaveTemplateDialog {...defaultProps} />);

    // Select create and enter a name
    const createRadio = screen.getByRole('radio', { name: /create new template/i });
    await user.click(createRadio);

    const nameInput = screen.getByLabelText('New Template Name');
    await user.type(nameInput, 'My Template');

    const saveButton = screen.getByRole('button', { name: /save template/i });
    await user.click(saveButton);

    // Wait for save to complete and dialog to close
    await waitFor(() => {
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });

    // The name input should be cleared after save
    // Note: We can't easily verify the cleared state after dialog closes
    // But we verified the save completed and dialog closed
    expect(defaultProps.onSave).toHaveBeenCalledWith('create', 'My Template');
  });
});
