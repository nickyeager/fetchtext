import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DualDocumentView } from '@/features/documents/components/DualDocumentView';

describe('DualDocumentView', () => {
  const defaultProps = {
    fileUrl: 'https://example.com/document.pdf',
    fileName: 'test-document.pdf',
    fileType: 'application/pdf',
    fileSize: 1024 * 100, // 100KB
    templateContent: 'Invoice for {{company_name}}: {{total_amount}}',
    extractedFields: {
      company_name: { value: 'Acme Corp', confidence: 0.95 },
      total_amount: { value: '$500.00', confidence: 0.92 },
    },
    templateName: 'Invoice Template',
    templateId: 1,
  };

  it('renders both document preview and template output panels', () => {
    render(<DualDocumentView {...defaultProps} />);

    // Check document preview panel is rendered
    expect(screen.getByText('Document Preview')).toBeInTheDocument();
    // File name is part of a larger text element
    expect(screen.getByText(/test-document\.pdf/)).toBeInTheDocument();

    // Check template output panel is rendered
    expect(screen.getByText('Generated Output')).toBeInTheDocument();
  });

  it('renders layout toggle buttons', () => {
    render(<DualDocumentView {...defaultProps} />);

    // Should have 4 layout buttons
    const buttons = screen.getAllByRole('button');

    // Find layout buttons by their titles
    expect(screen.getByTitle('Side by side view')).toBeInTheDocument();
    expect(screen.getByTitle('Stacked view')).toBeInTheDocument();
    expect(screen.getByTitle('Original only')).toBeInTheDocument();
    expect(screen.getByTitle('Output only')).toBeInTheDocument();
  });

  it('defaults to side-by-side layout', () => {
    render(<DualDocumentView {...defaultProps} />);

    // Side-by-side button should be active (has default variant)
    const sideBySideButton = screen.getByTitle('Side by side view');
    expect(sideBySideButton).toHaveClass('bg-primary');
  });

  it('switches to stacked layout when clicked', async () => {
    const user = userEvent.setup();
    render(<DualDocumentView {...defaultProps} />);

    const stackedButton = screen.getByTitle('Stacked view');
    await user.click(stackedButton);

    // Stacked button should now be active
    expect(stackedButton).toHaveClass('bg-primary');
  });

  it('hides template output when original-only is selected', async () => {
    const user = userEvent.setup();
    render(<DualDocumentView {...defaultProps} />);

    await user.click(screen.getByTitle('Original only'));

    // Template output should not be visible
    expect(screen.queryByText('Generated Output')).not.toBeInTheDocument();
    // Document preview should still be visible
    expect(screen.getByText('Document Preview')).toBeInTheDocument();
  });

  it('hides original document when output-only is selected', async () => {
    const user = userEvent.setup();
    render(<DualDocumentView {...defaultProps} />);

    await user.click(screen.getByTitle('Output only'));

    // Document preview should not be visible
    expect(screen.queryByText('Document Preview')).not.toBeInTheDocument();
    // Template output should still be visible
    expect(screen.getByText('Generated Output')).toBeInTheDocument();
  });

  it('renders extracted field values in template output', () => {
    render(<DualDocumentView {...defaultProps} />);

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('$500.00')).toBeInTheDocument();
  });

  it('shows template name in output panel', () => {
    render(<DualDocumentView {...defaultProps} />);

    expect(screen.getByText(/Invoice Template/)).toBeInTheDocument();
  });

  it('shows field count in output panel', () => {
    render(<DualDocumentView {...defaultProps} />);

    expect(screen.getByText('2/2 fields')).toBeInTheDocument();
  });

  it('shows resizable divider in side-by-side mode', () => {
    render(<DualDocumentView {...defaultProps} />);

    // The grip handle should be visible
    const divider = document.querySelector('.cursor-col-resize');
    expect(divider).toBeInTheDocument();
  });

  it('hides resizable divider in stacked mode', async () => {
    const user = userEvent.setup();
    render(<DualDocumentView {...defaultProps} />);

    await user.click(screen.getByTitle('Stacked view'));

    // The grip handle should not be visible
    const divider = document.querySelector('.cursor-col-resize');
    expect(divider).not.toBeInTheDocument();
  });

  it('handles drag to resize panels', () => {
    render(<DualDocumentView {...defaultProps} />);

    const divider = document.querySelector('.cursor-col-resize');
    expect(divider).toBeInTheDocument();

    // Simulate mousedown to start dragging
    if (divider) {
      fireEvent.mouseDown(divider, { clientX: 500 });

      // Simulate mousemove
      fireEvent.mouseMove(document, { clientX: 600 });

      // Simulate mouseup to stop dragging
      fireEvent.mouseUp(document);
    }

    // The component should still be functional after resize
    expect(screen.getByText('Generated Output')).toBeInTheDocument();
  });

  it('calls onEditTemplate when edit button clicked', async () => {
    const user = userEvent.setup();
    const mockEdit = vi.fn();

    render(<DualDocumentView {...defaultProps} onEditTemplate={mockEdit} />);

    const editButton = screen.getByRole('button', { name: /edit/i });
    await user.click(editButton);

    expect(mockEdit).toHaveBeenCalled();
  });

  it('calls onExport when export button clicked', async () => {
    const user = userEvent.setup();
    const mockExport = vi.fn();

    render(<DualDocumentView {...defaultProps} onExport={mockExport} />);

    const exportButton = screen.getByRole('button', { name: /export/i });
    await user.click(exportButton);

    expect(mockExport).toHaveBeenCalled();
  });

  it('handles null fileUrl gracefully', () => {
    render(
      <DualDocumentView
        {...defaultProps}
        fileUrl={null}
      />
    );

    // Should still render without crashing
    expect(screen.getByText('Document Preview')).toBeInTheDocument();
  });

  it('handles missing extractedFields gracefully', () => {
    render(
      <DualDocumentView
        {...defaultProps}
        templateContent="Hello {{name}}"
        extractedFields={{}}
      />
    );

    // Should show placeholder for missing field
    expect(screen.getByText('0/0 fields')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <DualDocumentView {...defaultProps} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('displays file size in document preview', () => {
    render(<DualDocumentView {...defaultProps} />);

    // File size should be displayed (100KB)
    expect(screen.getByText(/100.*KB/i)).toBeInTheDocument();
  });

  it('renders correctly with image file type', () => {
    render(
      <DualDocumentView
        {...defaultProps}
        fileType="image/png"
        fileName="receipt.png"
      />
    );

    // File name is part of a text element that may include file size
    expect(screen.getByText(/receipt\.png/)).toBeInTheDocument();
  });
});
