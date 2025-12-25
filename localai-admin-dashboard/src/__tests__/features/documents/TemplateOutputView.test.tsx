import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateOutputView } from '@/features/documents/components/TemplateOutputView';

describe('TemplateOutputView', () => {
  const mockTemplateContent = `Dear {{company_name}},

This is regarding invoice {{invoice_number}} dated {{invoice_date}}.
The total amount due is {{total_amount}}.

Best regards,
{{sender_name}}`;

  const mockExtractedFields = {
    company_name: { value: 'Acme Corporation', confidence: 0.95 },
    invoice_number: { value: 'INV-2025-001', confidence: 0.92 },
    invoice_date: { value: '2025-01-15', confidence: 0.88 },
    total_amount: { value: '$1,500.00', confidence: 0.97, sourceText: 'Total: $1,500.00' },
    sender_name: { value: null }, // Missing field
  };

  it('renders the component with template name', () => {
    render(
      <TemplateOutputView
        templateContent={mockTemplateContent}
        extractedFields={mockExtractedFields}
        templateName="Invoice Template"
      />
    );

    expect(screen.getByText('Generated Output')).toBeInTheDocument();
    expect(screen.getByText(/Invoice Template/)).toBeInTheDocument();
  });

  it('displays field count badge', () => {
    render(
      <TemplateOutputView
        templateContent={mockTemplateContent}
        extractedFields={mockExtractedFields}
      />
    );

    // 4 out of 5 fields have values
    expect(screen.getByText('4/5 fields')).toBeInTheDocument();
  });

  it('renders extracted values inline in template', () => {
    render(
      <TemplateOutputView
        templateContent={mockTemplateContent}
        extractedFields={mockExtractedFields}
      />
    );

    // Check that extracted values appear
    expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    expect(screen.getByText('INV-2025-001')).toBeInTheDocument();
    expect(screen.getByText('2025-01-15')).toBeInTheDocument();
    expect(screen.getByText('$1,500.00')).toBeInTheDocument();
  });

  it('shows placeholder syntax for missing values', () => {
    render(
      <TemplateOutputView
        templateContent={mockTemplateContent}
        extractedFields={mockExtractedFields}
      />
    );

    // Missing field should show placeholder syntax
    expect(screen.getByText('{{sender_name}}')).toBeInTheDocument();
  });

  it('shows tooltip with confidence on hover', async () => {
    const user = userEvent.setup();

    render(
      <TemplateOutputView
        templateContent={mockTemplateContent}
        extractedFields={mockExtractedFields}
      />
    );

    // Find and hover over a filled value
    const acmeElement = screen.getByText('Acme Corporation');
    const chip = acmeElement.closest('span[class*="inline-flex"]');

    if (chip) {
      await user.hover(chip);

      await waitFor(() => {
        // Check tooltip content shows confidence
        expect(screen.getAllByText(/95%/).length).toBeGreaterThan(0);
      });
    }
  });

  it('shows tooltip with source text when provided', async () => {
    const user = userEvent.setup();

    render(
      <TemplateOutputView
        templateContent={mockTemplateContent}
        extractedFields={mockExtractedFields}
      />
    );

    // Find and hover over the total amount field which has sourceText
    const amountElement = screen.getByText('$1,500.00');
    const chip = amountElement.closest('span[class*="inline-flex"]');

    if (chip) {
      await user.hover(chip);

      await waitFor(() => {
        expect(screen.getAllByText(/Source:/).length).toBeGreaterThan(0);
      });
    }
  });

  it('shows "No value extracted" tooltip for missing fields', async () => {
    const user = userEvent.setup();

    render(
      <TemplateOutputView
        templateContent={mockTemplateContent}
        extractedFields={mockExtractedFields}
      />
    );

    // Find and hover over the missing field placeholder
    const missingElement = screen.getByText('{{sender_name}}');
    const chip = missingElement.closest('span[class*="inline-flex"]');

    if (chip) {
      await user.hover(chip);

      await waitFor(() => {
        expect(screen.getAllByText('No value extracted').length).toBeGreaterThan(0);
      });
    }
  });

  it('handles string values in extractedFields', () => {
    const stringFields = {
      company_name: 'Simple String Value',
      invoice_number: null,
    };

    render(
      <TemplateOutputView
        templateContent="{{company_name}} - {{invoice_number}}"
        extractedFields={stringFields}
      />
    );

    expect(screen.getByText('Simple String Value')).toBeInTheDocument();
  });

  it('renders edit button when templateId and onEditTemplate provided', () => {
    const mockEdit = vi.fn();

    render(
      <TemplateOutputView
        templateContent={mockTemplateContent}
        extractedFields={mockExtractedFields}
        templateId={123}
        onEditTemplate={mockEdit}
      />
    );

    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('renders export button when onExport provided', () => {
    const mockExport = vi.fn();

    render(
      <TemplateOutputView
        templateContent={mockTemplateContent}
        extractedFields={mockExtractedFields}
        onExport={mockExport}
      />
    );

    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  it('calls onExport when export button clicked', async () => {
    const user = userEvent.setup();
    const mockExport = vi.fn();

    render(
      <TemplateOutputView
        templateContent={mockTemplateContent}
        extractedFields={mockExtractedFields}
        onExport={mockExport}
      />
    );

    await user.click(screen.getByRole('button', { name: /export/i }));
    expect(mockExport).toHaveBeenCalled();
  });

  it('copies filled template to clipboard', async () => {
    const user = userEvent.setup();
    const mockWriteText = vi.fn().mockResolvedValue(undefined);

    // Mock clipboard properly using vi.stubGlobal
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: mockWriteText },
    });

    render(
      <TemplateOutputView
        templateContent={mockTemplateContent}
        extractedFields={mockExtractedFields}
      />
    );

    const copyButton = screen.getByTitle('Copy to clipboard');
    await user.click(copyButton);

    expect(mockWriteText).toHaveBeenCalled();
    // Verify the copied text has values filled in
    const copiedText = mockWriteText.mock.calls[0][0];
    expect(copiedText).toContain('Acme Corporation');
    expect(copiedText).toContain('INV-2025-001');

    vi.unstubAllGlobals();
  });

  it('shows raw template syntax when showRaw is true', () => {
    render(
      <TemplateOutputView
        templateContent="Hello {{name}}"
        extractedFields={{ name: { value: 'John' } }}
        showRaw={true}
      />
    );

    // When showRaw is true, should show {{name}} instead of John
    expect(screen.getByText('{{name}}')).toBeInTheDocument();
  });

  it('applies filled styling to fields with values', () => {
    render(
      <TemplateOutputView
        templateContent="{{filled_field}}"
        extractedFields={{ filled_field: { value: 'Has Value' } }}
      />
    );

    // Find the chip container with inline-flex class that contains the value
    const valueElement = screen.getByText('Has Value');
    const chip = valueElement.closest('span[class*="inline-flex"]');
    expect(chip).toHaveClass('bg-green-100');
  });

  it('applies missing styling to fields without values', () => {
    render(
      <TemplateOutputView
        templateContent="{{missing_field}}"
        extractedFields={{ missing_field: { value: null } }}
      />
    );

    // Find the chip container with inline-flex class that contains the placeholder
    const placeholderElement = screen.getByText('{{missing_field}}');
    const chip = placeholderElement.closest('span[class*="inline-flex"]');
    expect(chip).toHaveClass('border-dashed');
  });
});
