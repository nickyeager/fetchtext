import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentWorkflow } from '../DocumentWorkflow';
import { DocumentTemplateService } from '../../services/template-service';

// Mock the template service
vi.mock('../../services/template-service', () => ({
  DocumentTemplateService: {
    getTemplateById: vi.fn(),
  },
}));

// Mock the document processor
vi.mock('@/lib/document-processor-enhanced', () => ({
  DocumentProcessorEnhanced: vi.fn().mockImplementation(() => ({
    processDocumentWithDocling: vi.fn(),
    getBackendStatus: vi.fn(),
  })),
}));

const mockTemplate = {
  id: 2,
  uuid: 'test-uuid-123',
  name: 'Business Invoice Template',
  description: 'Extract invoice data including amounts, dates, and vendor information',
  template_content: 'Invoice for {{vendor_name}} - Amount: {{total_amount}} - Date: {{invoice_date}}',
  template_type: 'document',
  smart_variables: [
    {
      id: 'vendor_name',
      name: 'vendor_name',
      type: 'text' as const,
      description: 'Name of the vendor or company issuing the invoice',
      extraction_hints: ['vendor', 'company', 'from'],
      default_value: '',
    },
    {
      id: 'total_amount',
      name: 'total_amount',
      type: 'currency' as const,
      description: 'Total amount due on the invoice',
      extraction_hints: ['total', 'amount', 'due', '$'],
      default_value: '',
    },
    {
      id: 'invoice_date',
      name: 'invoice_date',
      type: 'date' as const,
      description: 'Date when the invoice was issued',
      extraction_hints: ['date', 'issued', 'invoice date'],
      default_value: '',
    },
  ],
  extraction_rules: [],
  generation_settings: {},
  category: 'business',
  tags: ['invoice', 'business', 'finance'],
  usage_count: 15,
  rating: 4.5,
  is_public: true,
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-20T14:30:00Z',
};

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('DocumentWorkflow Template Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load and display template information when templateId is provided', async () => {
    // Mock successful template loading
    vi.mocked(DocumentTemplateService.getTemplateById).mockResolvedValue(mockTemplate);

    renderWithQueryClient(<DocumentWorkflow selectedTemplateId="2" />);

    // Wait for template to load and display
    await waitFor(() => {
      expect(screen.getByText('Business Invoice Template')).toBeInTheDocument();
    });

    // Verify template information is displayed
    expect(screen.getByText('Business Invoice Template')).toBeInTheDocument();
    expect(screen.getByText('Extract invoice data including amounts, dates, and vendor information')).toBeInTheDocument();
    
    // Verify smart variables are shown
    expect(screen.getByText('Template Fields (3 fields):')).toBeInTheDocument();
    expect(screen.getByText('vendor_name')).toBeInTheDocument();
    expect(screen.getByText('total_amount')).toBeInTheDocument();
    expect(screen.getByText('invoice_date')).toBeInTheDocument();
    
    // Verify field types are displayed
    expect(screen.getByText('text')).toBeInTheDocument();
    expect(screen.getByText('currency')).toBeInTheDocument();
    expect(screen.getByText('date')).toBeInTheDocument();
    
    // Verify template preview is shown
    expect(screen.getByText(/Invoice for {{vendor_name}}/)).toBeInTheDocument();
  });

  it('should display loading state while template is being fetched', () => {
    // Mock pending template loading
    vi.mocked(DocumentTemplateService.getTemplateById).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    );

    renderWithQueryClient(<DocumentWorkflow selectedTemplateId="2" />);

    // Verify loading state
    expect(screen.getByText('Loading template...')).toBeInTheDocument();
  });

  it('should handle template not found error gracefully', async () => {
    // Mock template not found
    vi.mocked(DocumentTemplateService.getTemplateById).mockRejectedValue(
      new Error('Template not found')
    );

    renderWithQueryClient(<DocumentWorkflow selectedTemplateId="999" />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText(/Error loading template/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Template not found/)).toBeInTheDocument();
  });

  it('should work without templateId (existing functionality)', () => {
    renderWithQueryClient(<DocumentWorkflow />);

    // Should not show template-specific sections
    expect(screen.queryByText('Loading template...')).not.toBeInTheDocument();
    expect(screen.queryByText('Template Fields')).not.toBeInTheDocument();
    
    // Should still show basic workflow components
    expect(screen.getByText('Document Workflow')).toBeInTheDocument();
    expect(screen.getByText('Upload Document')).toBeInTheDocument();
  });

  it('should call DocumentTemplateService.getTemplateById with correct templateId', () => {
    vi.mocked(DocumentTemplateService.getTemplateById).mockResolvedValue(mockTemplate);

    renderWithQueryClient(<DocumentWorkflow selectedTemplateId="123" />);

    expect(DocumentTemplateService.getTemplateById).toHaveBeenCalledWith('123');
  });

  it('should display template usage stats and metadata', async () => {
    vi.mocked(DocumentTemplateService.getTemplateById).mockResolvedValue(mockTemplate);

    renderWithQueryClient(<DocumentWorkflow selectedTemplateId="2" />);

    await waitFor(() => {
      expect(screen.getByText('Business Invoice Template')).toBeInTheDocument();
    });

    // Check for usage stats
    expect(screen.getByText('15 uses')).toBeInTheDocument();
    expect(screen.getByText('★ 4.5')).toBeInTheDocument();
    
    // Check for category and tags
    expect(screen.getByText('business')).toBeInTheDocument();
    expect(screen.getByText('invoice')).toBeInTheDocument();
    expect(screen.getByText('finance')).toBeInTheDocument();
  });

  it('should show smart variable descriptions and extraction hints', async () => {
    vi.mocked(DocumentTemplateService.getTemplateById).mockResolvedValue(mockTemplate);

    renderWithQueryClient(<DocumentWorkflow selectedTemplateId="2" />);

    await waitFor(() => {
      expect(screen.getByText('Business Invoice Template')).toBeInTheDocument();
    });

    // Check for field descriptions
    expect(screen.getByText('Name of the vendor or company issuing the invoice')).toBeInTheDocument();
    expect(screen.getByText('Total amount due on the invoice')).toBeInTheDocument();
    expect(screen.getByText('Date when the invoice was issued')).toBeInTheDocument();
    
    // Check for extraction hints
    expect(screen.getByText('Hints: vendor, company, from')).toBeInTheDocument();
    expect(screen.getByText('Hints: total, amount, due, $')).toBeInTheDocument();
    expect(screen.getByText('Hints: date, issued, invoice date')).toBeInTheDocument();
  });
});