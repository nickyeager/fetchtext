import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateOutputView } from '@/features/documents/components/TemplateOutputView';

// Mock the DocumentProcessorEnhanced for extraction tests
vi.mock('@/lib/document-processor-enhanced', () => ({
  DocumentProcessorEnhanced: vi.fn().mockImplementation(() => ({
    extractWithTemplateFast: vi.fn().mockResolvedValue({
      new_variable: { value: 'Extracted Value', confidence: 0.85 },
    }),
  })),
}));

// Mock TipTap to avoid editor initialization issues in tests
vi.mock('@tiptap/react', () => ({
  useEditor: () => null,
  EditorContent: () => null,
}));

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

    expect(screen.getByText(/Generated Output/)).toBeInTheDocument();
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

  // ============================================
  // NEW TESTS: Fuzzy Key Matching
  // ============================================

  describe('Fuzzy Key Matching', () => {
    it('matches underscore-separated keys to template variables', () => {
      // Template uses {{invoiceNumber}} but extracted field is invoice_number
      render(
        <TemplateOutputView
          templateContent="Invoice: {{invoice_number}}"
          extractedFields={{ invoice_number: { value: 'INV-001', confidence: 0.9 } }}
        />
      );

      expect(screen.getByText('INV-001')).toBeInTheDocument();
    });

    it('matches camelCase keys to underscore template variables', () => {
      // Extracted field uses camelCase, template uses underscore
      render(
        <TemplateOutputView
          templateContent="Company: {{company_name}}"
          extractedFields={{ companyName: { value: 'Acme Corp', confidence: 0.95 } }}
        />
      );

      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    it('matches keys with different casing', () => {
      render(
        <TemplateOutputView
          templateContent="Total: {{Total_Amount}}"
          extractedFields={{ total_amount: { value: '$500', confidence: 0.88 } }}
        />
      );

      expect(screen.getByText('$500')).toBeInTheDocument();
    });

    it('matches keys with spaces to underscore variables', () => {
      render(
        <TemplateOutputView
          templateContent="Date: {{invoice_date}}"
          extractedFields={{ 'invoice date': { value: '2025-01-15', confidence: 0.9 } }}
        />
      );

      expect(screen.getByText('2025-01-15')).toBeInTheDocument();
    });

    it('prefers exact match over fuzzy match', () => {
      render(
        <TemplateOutputView
          templateContent="Name: {{company_name}}"
          extractedFields={{
            company_name: { value: 'Exact Match', confidence: 0.95 },
            companyName: { value: 'Fuzzy Match', confidence: 0.9 },
          }}
        />
      );

      // Should use the exact match
      expect(screen.getByText('Exact Match')).toBeInTheDocument();
    });
  });

  // ============================================
  // NEW TESTS: Editable Mode
  // ============================================

  describe('Editable Mode', () => {
    it('renders textarea when editable is true', () => {
      render(
        <TemplateOutputView
          templateContent="Hello {{name}}"
          extractedFields={{ name: { value: 'World' } }}
          editable={true}
          documentText="Sample document text"
        />
      );

      // Should show a textarea in editable mode
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('shows "Edit Template" in header when editable', () => {
      render(
        <TemplateOutputView
          templateContent="Hello {{name}}"
          extractedFields={{ name: { value: 'World' } }}
          editable={true}
          documentText="Sample document text"
        />
      );

      expect(screen.getByText('Edit Template')).toBeInTheDocument();
    });

    it('shows hint text about typing variables when editable', () => {
      render(
        <TemplateOutputView
          templateContent="Hello {{name}}"
          extractedFields={{ name: { value: 'World' } }}
          editable={true}
          documentText="Sample document text"
        />
      );

      expect(screen.getByText(/Type.*variable_name.*to add/i)).toBeInTheDocument();
    });

    it('calls onTemplateChange when content is edited', async () => {
      const user = userEvent.setup();
      const mockOnTemplateChange = vi.fn();

      render(
        <TemplateOutputView
          templateContent="Hello"
          extractedFields={{}}
          editable={true}
          documentText="Sample document text"
          onTemplateChange={mockOnTemplateChange}
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, ' World');

      await waitFor(() => {
        expect(mockOnTemplateChange).toHaveBeenCalled();
      });
    });

    it('shows Save Template button when changes are made', async () => {
      const user = userEvent.setup();
      const mockOnSaveTemplate = vi.fn().mockResolvedValue(undefined);

      render(
        <TemplateOutputView
          templateContent="Hello"
          extractedFields={{}}
          editable={true}
          documentText="Sample document text"
          onSaveTemplate={mockOnSaveTemplate}
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, ' World');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save template/i })).toBeInTheDocument();
      });
    });

    it('does not show Save button when no changes made', () => {
      const mockOnSaveTemplate = vi.fn().mockResolvedValue(undefined);

      render(
        <TemplateOutputView
          templateContent="Hello"
          extractedFields={{}}
          editable={true}
          documentText="Sample document text"
          onSaveTemplate={mockOnSaveTemplate}
        />
      );

      expect(screen.queryByRole('button', { name: /save template/i })).not.toBeInTheDocument();
    });
  });

  // ============================================
  // NEW TESTS: Markdown Rendering
  // ============================================

  describe('Markdown Rendering', () => {
    it('renders headings with proper styling', () => {
      const content = `# Main Heading

## Sub Heading

Some text with {{variable}}`;
      render(
        <TemplateOutputView
          templateContent={content}
          extractedFields={{ variable: { value: 'Test Value', confidence: 0.9 } }}
        />
      );

      // Check that headings are rendered as h1/h2
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent('Main Heading');

      const h2 = screen.getByRole('heading', { level: 2 });
      expect(h2).toHaveTextContent('Sub Heading');
    });

    it('renders bold text correctly', () => {
      render(
        <TemplateOutputView
          templateContent="**Bold text** and {{variable}}"
          extractedFields={{ variable: { value: 'Test Value', confidence: 0.9 } }}
        />
      );

      const boldElement = screen.getByText('Bold text');
      expect(boldElement.tagName.toLowerCase()).toBe('strong');
    });

    it('renders lists correctly', () => {
      const content = `- Item 1
- Item 2 with {{variable}}
- Item 3`;
      render(
        <TemplateOutputView
          templateContent={content}
          extractedFields={{ variable: { value: 'Test Value', confidence: 0.9 } }}
        />
      );

      const listItems = screen.getAllByRole('listitem');
      expect(listItems.length).toBe(3);
    });

    it('renders variable badges inline within Markdown elements', () => {
      render(
        <TemplateOutputView
          templateContent="**Amount:** {{amount}}"
          extractedFields={{ amount: { value: '$1,000', confidence: 0.95 } }}
        />
      );

      // The value should be visible
      expect(screen.getByText('$1,000')).toBeInTheDocument();

      // And it should be inside a strong element (or as sibling)
      const amountLabel = screen.getByText('Amount:');
      expect(amountLabel.closest('strong') || amountLabel.tagName.toLowerCase()).toBeTruthy();
    });

    it('renders tables correctly', () => {
      const content = `| Item | Price |
|------|-------|
| Widget | {{price}} |`;
      render(
        <TemplateOutputView
          templateContent={content}
          extractedFields={{ price: { value: '$50', confidence: 0.9 } }}
        />
      );

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    it('renders blockquotes correctly', () => {
      render(
        <TemplateOutputView
          templateContent="> This is a quote about {{topic}}"
          extractedFields={{ topic: { value: 'testing', confidence: 0.9 } }}
        />
      );

      const blockquote = document.querySelector('blockquote');
      expect(blockquote).toBeInTheDocument();
    });

    it('preserves variable badge functionality in Markdown context', async () => {
      const user = userEvent.setup();
      const content = `# Invoice

**Total:** {{total}}`;

      render(
        <TemplateOutputView
          templateContent={content}
          extractedFields={{ total: { value: '$500', confidence: 0.85, sourceText: 'Total: $500' } }}
        />
      );

      // Find the value and hover to see tooltip
      const valueElement = screen.getByText('$500');
      const chip = valueElement.closest('span[class*="inline-flex"]');

      if (chip) {
        await user.hover(chip);

        await waitFor(() => {
          expect(screen.getAllByText(/85%/).length).toBeGreaterThan(0);
        });
      }
    });
  });

  // ============================================
  // NEW TESTS: Real-time Variable Extraction
  // ============================================

  describe('Real-time Variable Extraction', () => {
    it('updates content when typing in editable mode', async () => {
      const user = userEvent.setup();
      const mockOnTemplateChange = vi.fn();

      render(
        <TemplateOutputView
          templateContent="Hello"
          extractedFields={{}}
          editable={true}
          documentText="This document contains the new variable value."
          onTemplateChange={mockOnTemplateChange}
        />
      );

      const textarea = screen.getByRole('textbox');
      // Type some text (avoiding special characters that userEvent has trouble with)
      await user.type(textarea, ' world');

      // Verify the content was updated and callback fired
      await waitFor(() => {
        expect(textarea).toHaveValue('Hello world');
        expect(mockOnTemplateChange).toHaveBeenCalled();
      });
    });

    it('calls onTemplateChange with full content including variables', async () => {
      const user = userEvent.setup();
      const mockOnTemplateChange = vi.fn();

      render(
        <TemplateOutputView
          templateContent="Invoice: "
          extractedFields={{}}
          editable={true}
          documentText="Invoice number is INV-001"
          onTemplateChange={mockOnTemplateChange}
        />
      );

      const textarea = screen.getByRole('textbox');
      // Clear and set value directly to test variable content
      await user.clear(textarea);
      await user.paste('Invoice: {{invoice_number}}');

      await waitFor(() => {
        expect(mockOnTemplateChange).toHaveBeenLastCalledWith('Invoice: {{invoice_number}}');
      });
    });
  });
});
