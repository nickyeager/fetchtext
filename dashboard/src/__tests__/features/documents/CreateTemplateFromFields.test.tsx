/**
 * Tests for CreateTemplateFromFields component
 *
 * TDD: These tests verify that extracted fields are properly converted
 * to smart_variables with all required properties, especially the 'id' field.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateTemplateFromFields } from '@/features/documents/components/CreateTemplateFromFields';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CreateTemplateFromFields', () => {
  const mockOnClose = vi.fn();
  const mockOnCreateTemplate = vi.fn();

  const mockFields = [
    {
      id: 'field_1',
      name: 'vendor_name',
      value: 'Acme Corp',
      confidence: 0.95,
      type: 'text' as const,
    },
    {
      id: 'field_2',
      name: 'invoice_amount',
      value: '$1,500.00',
      confidence: 0.88,
      type: 'currency' as const,
    },
    {
      id: 'field_3',
      name: 'invoice_date',
      value: '2024-01-15',
      confidence: 0.92,
      type: 'date' as const,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnCreateTemplate.mockResolvedValue(undefined);
  });

  it('should render with fields displayed', async () => {
    render(
      <CreateTemplateFromFields
        isOpen={true}
        onClose={mockOnClose}
        fields={mockFields}
        documentType="invoice"
        documentName="test-invoice.pdf"
        onCreateTemplate={mockOnCreateTemplate}
      />
    );

    // Wait for dialog to open and content to appear
    await waitFor(() => {
      // Look for field names - they're formatted with underscores replaced by spaces
      expect(screen.getByText('Vendor Name')).toBeInTheDocument();
    });
    expect(screen.getByText('Invoice Amount')).toBeInTheDocument();
    expect(screen.getByText('Invoice Date')).toBeInTheDocument();
  });

  it('should include id field in smart_variables when creating template', async () => {
    const user = userEvent.setup();

    render(
      <CreateTemplateFromFields
        isOpen={true}
        onClose={mockOnClose}
        fields={mockFields}
        documentType="invoice"
        documentName="test-invoice.pdf"
        onCreateTemplate={mockOnCreateTemplate}
      />
    );

    // Wait for dialog to be ready
    await waitFor(() => {
      expect(screen.getByText('Vendor Name')).toBeInTheDocument();
    });

    // Click create button
    const createButton = screen.getByRole('button', { name: /create template/i });
    await user.click(createButton);

    // Wait for the template creation to be called
    await waitFor(() => {
      expect(mockOnCreateTemplate).toHaveBeenCalledTimes(1);
    });

    // Verify smart_variables have 'id' field
    const templateData = mockOnCreateTemplate.mock.calls[0][0];
    expect(templateData.smart_variables).toBeDefined();
    expect(templateData.smart_variables.length).toBe(3);

    // CRITICAL: Each smart_variable MUST have an 'id' field
    templateData.smart_variables.forEach((variable: any) => {
      expect(variable.id).toBeDefined();
      expect(typeof variable.id).toBe('string');
      expect(variable.id.length).toBeGreaterThan(0);
    });

    // Verify all expected names are present
    const names = templateData.smart_variables.map((v: any) => v.name);
    expect(names).toContain('vendor_name');
    expect(names).toContain('invoice_amount');
    expect(names).toContain('invoice_date');
  });

  it('should generate unique ids for each smart_variable', async () => {
    const user = userEvent.setup();

    render(
      <CreateTemplateFromFields
        isOpen={true}
        onClose={mockOnClose}
        fields={mockFields}
        documentType="invoice"
        documentName="test-invoice.pdf"
        onCreateTemplate={mockOnCreateTemplate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Vendor Name')).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /create template/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(mockOnCreateTemplate).toHaveBeenCalled();
    });

    const templateData = mockOnCreateTemplate.mock.calls[0][0];
    const ids = templateData.smart_variables.map((v: any) => v.id);
    const uniqueIds = new Set(ids);

    // All IDs should be unique
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should preserve original field properties in smart_variables', async () => {
    const user = userEvent.setup();

    render(
      <CreateTemplateFromFields
        isOpen={true}
        onClose={mockOnClose}
        fields={mockFields}
        documentType="invoice"
        documentName="test-invoice.pdf"
        onCreateTemplate={mockOnCreateTemplate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Vendor Name')).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /create template/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(mockOnCreateTemplate).toHaveBeenCalled();
    });

    const templateData = mockOnCreateTemplate.mock.calls[0][0];

    // Check vendor_name variable
    const vendorVar = templateData.smart_variables.find((v: any) => v.name === 'vendor_name');
    expect(vendorVar).toBeDefined();
    expect(vendorVar.id).toBeDefined(); // Must have id
    expect(vendorVar.type).toBe('text');
    expect(vendorVar.confidence_threshold).toBeGreaterThanOrEqual(0.5);
    expect(vendorVar.extraction_hints).toBeInstanceOf(Array);

    // Check invoice_amount variable
    const amountVar = templateData.smart_variables.find((v: any) => v.name === 'invoice_amount');
    expect(amountVar).toBeDefined();
    expect(amountVar.id).toBeDefined(); // Must have id
    expect(amountVar.type).toBe('currency');
  });

  it('should call onClose after successful template creation', async () => {
    const user = userEvent.setup();

    render(
      <CreateTemplateFromFields
        isOpen={true}
        onClose={mockOnClose}
        fields={mockFields}
        documentType="invoice"
        documentName="test-invoice.pdf"
        onCreateTemplate={mockOnCreateTemplate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Vendor Name')).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /create template/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
