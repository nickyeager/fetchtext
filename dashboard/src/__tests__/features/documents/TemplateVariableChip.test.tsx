import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateVariableChip } from '@/features/documents/components/TemplateVariableChip';

describe('TemplateVariableChip', () => {
  it('displays variable name in curly brace syntax', () => {
    render(
      <TemplateVariableChip
        variableName="company_name"
        extractedValue="Acme Corp"
        confidence={0.95}
      />
    );

    expect(screen.getByText('company_name')).toBeInTheDocument();
    // Check curly braces are rendered
    expect(screen.getAllByText('{')).toHaveLength(2);
    expect(screen.getAllByText('}')).toHaveLength(2);
  });

  it('shows extracted value on hover', async () => {
    const user = userEvent.setup();

    render(
      <TemplateVariableChip
        variableName="company_name"
        extractedValue="Acme Corp"
        confidence={0.95}
      />
    );

    const chip = screen.getByRole('button');
    await user.hover(chip);

    await waitFor(() => {
      // Use getAllByText since Radix UI may render content in multiple places (portal)
      const acmeCorpElements = screen.getAllByText('Acme Corp');
      expect(acmeCorpElements.length).toBeGreaterThan(0);
      expect(screen.getAllByText(/95%/).length).toBeGreaterThan(0);
    });
  });

  it('shows source text in tooltip when provided', async () => {
    const user = userEvent.setup();

    render(
      <TemplateVariableChip
        variableName="company_name"
        extractedValue="Acme Corp"
        confidence={0.95}
        sourceText="Company: Acme Corporation LLC"
      />
    );

    const chip = screen.getByRole('button');
    await user.hover(chip);

    await waitFor(() => {
      expect(screen.getAllByText(/Source:/).length).toBeGreaterThan(0);
    });
  });

  it('shows "No value extracted" when value is null', async () => {
    const user = userEvent.setup();

    render(
      <TemplateVariableChip
        variableName="missing_field"
        extractedValue={null}
      />
    );

    const chip = screen.getByRole('button');
    await user.hover(chip);

    await waitFor(() => {
      expect(screen.getAllByText('No value extracted').length).toBeGreaterThan(0);
    });
  });

  it('applies dashed border style when no value', () => {
    render(
      <TemplateVariableChip
        variableName="empty_field"
        extractedValue={null}
      />
    );

    const chip = screen.getByRole('button');
    expect(chip).toHaveClass('border-dashed');
  });

  it('displays field type badge when provided', async () => {
    const user = userEvent.setup();

    render(
      <TemplateVariableChip
        variableName="invoice_date"
        extractedValue="2025-01-15"
        confidence={0.88}
        fieldType="date"
      />
    );

    const chip = screen.getByRole('button');
    await user.hover(chip);

    await waitFor(() => {
      expect(screen.getAllByText('date').length).toBeGreaterThan(0);
    });
  });
});
