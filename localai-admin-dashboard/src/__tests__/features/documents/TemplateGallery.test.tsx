import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TemplateGallery } from '../../../features/documents/components/TemplateGallery';

// Mock the templates data first
const mockTemplates = [
  {
    id: 1,
    uuid: 'uuid-1',
    name: 'Project Proposal',
    description: 'A comprehensive project proposal template',
    template_content: 'This is a project proposal template content...',
    template_type: 'document',
    smart_variables: [
      {
        id: 'var1',
        name: 'project_name',
        type: 'text' as const,
        description: 'Name of the project',
        extraction_hints: ['project title', 'project name'],
      }
    ],
    extraction_rules: [],
    generation_settings: {},
    category: 'business',
    tags: ['project', 'proposal'],
    usage_count: 10,
    rating: 4.5,
    is_public: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    uuid: 'uuid-2',
    name: 'Contract Agreement',
    description: 'Standard contract template',
    template_content: 'This is a contract agreement template content...',
    template_type: 'document',
    smart_variables: [],
    extraction_rules: [],
    generation_settings: {},
    category: 'legal',
    tags: ['contract', 'legal'],
    usage_count: 5,
    rating: 4.0,
    is_public: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

// Simple mock for React Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: mockTemplates,
    isLoading: false,
    error: null,
  }),
}));

// Mock the template service
vi.mock('../../../features/documents/services/template-service', () => ({
  DocumentTemplateService: {
    getTemplates: () => Promise.resolve(mockTemplates),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
  },
}));

describe('TemplateGallery', () => {
  const mockOnSelectTemplate = vi.fn();
  const mockOnCreateTemplate = vi.fn();

  const renderComponent = () => {
    return render(
      <TemplateGallery 
        onSelectTemplate={mockOnSelectTemplate}
        onCreateTemplate={mockOnCreateTemplate}
      />
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should display a list of templates', () => {
    renderComponent();

    expect(screen.getByText('Smart Document Templates')).toBeInTheDocument();
    expect(screen.getByText('Project Proposal')).toBeInTheDocument();
    expect(screen.getByText('Contract Agreement')).toBeInTheDocument();
  });

  it('should render search input', () => {
    renderComponent();

    const searchInput = screen.getByPlaceholderText('Search templates...');
    expect(searchInput).toBeInTheDocument();
    expect((searchInput as HTMLInputElement).value).toBe('');
  });

  it('should display category filters', () => {
    renderComponent();

    expect(screen.getByRole('button', { name: 'all' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'business' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'legal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'marketing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'hr' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'finance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'technical' })).toBeInTheDocument();
  });

  it('should display template details', () => {
    renderComponent();

    expect(screen.getByText('A comprehensive project proposal template')).toBeInTheDocument();
    expect(screen.getByText('Standard contract template')).toBeInTheDocument();
    expect(screen.getByText('10 uses')).toBeInTheDocument();
    expect(screen.getByText('5 uses')).toBeInTheDocument();
  });

  it('should display create template button', () => {
    renderComponent();

    const createButton = screen.getByRole('button', { name: /create template/i });
    expect(createButton).toBeInTheDocument();
  });
});
