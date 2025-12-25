import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DocumentPreviewPanel } from '@/features/documents/components/DocumentPreviewPanel';

describe('DocumentPreviewPanel', () => {
  it('displays document name and size', () => {
    render(
      <DocumentPreviewPanel
        fileUrl="https://example.com/doc.pdf"
        fileName="invoice.pdf"
        fileType="application/pdf"
        fileSize={1024 * 500} // 500 KB
      />
    );

    expect(screen.getByText(/invoice.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/500.0 KB/)).toBeInTheDocument();
  });

  it('shows PDF preview for PDF files', () => {
    render(
      <DocumentPreviewPanel
        fileUrl="https://example.com/doc.pdf"
        fileName="invoice.pdf"
        fileType="application/pdf"
      />
    );

    const iframe = screen.getByTitle('Preview of invoice.pdf');
    expect(iframe).toBeInTheDocument();
    expect(iframe.tagName).toBe('IFRAME');
  });

  it('shows image preview for image files', () => {
    render(
      <DocumentPreviewPanel
        fileUrl="https://example.com/receipt.png"
        fileName="receipt.png"
        fileType="image/png"
      />
    );

    const img = screen.getByAltText('receipt.png');
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe('IMG');
  });

  it('shows error state when fileUrl is null', () => {
    render(
      <DocumentPreviewPanel
        fileUrl={null}
        fileName="missing.pdf"
        fileType="application/pdf"
      />
    );

    expect(screen.getByText('No document file available')).toBeInTheDocument();
  });

  it('has download and open buttons', () => {
    render(
      <DocumentPreviewPanel
        fileUrl="https://example.com/doc.pdf"
        fileName="invoice.pdf"
        fileType="application/pdf"
      />
    );

    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
  });

  it('disables buttons when no file URL', () => {
    render(
      <DocumentPreviewPanel
        fileUrl={null}
        fileName="missing.pdf"
        fileType="application/pdf"
      />
    );

    expect(screen.getByRole('button', { name: /download/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /open/i })).toBeDisabled();
  });

  it('formats file size correctly for KB', () => {
    render(
      <DocumentPreviewPanel
        fileUrl="https://example.com/doc.pdf"
        fileName="test.pdf"
        fileType="application/pdf"
        fileSize={2048}
      />
    );

    expect(screen.getByText(/2.0 KB/)).toBeInTheDocument();
  });

  it('formats file size correctly for MB', () => {
    render(
      <DocumentPreviewPanel
        fileUrl="https://example.com/doc.pdf"
        fileName="test.pdf"
        fileType="application/pdf"
        fileSize={1024 * 1024 * 2.5}
      />
    );

    expect(screen.getByText(/2.5 MB/)).toBeInTheDocument();
  });
});
