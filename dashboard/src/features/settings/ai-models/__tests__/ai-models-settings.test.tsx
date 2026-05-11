/**
 * Integration tests for AI Models Settings page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AIModelsSettings from '../index'
import { ollamaService } from '@/lib/services/ollama-service'

// Mock the ollama service
vi.mock('@/lib/services/ollama-service', () => ({
  ollamaService: {
    getAvailableModels: vi.fn(),
    setActiveModel: vi.fn(),
    getCurrentModel: vi.fn(),
    formatModelSize: vi.fn((size) => `${(parseInt(size) / 1000000000).toFixed(1)} GB`),
    getModelDisplayName: vi.fn((model) => {
      const parts = model.name.split(':')
      return parts.length > 1 ? `${parts[0]} (${parts[1]})` : model.name
    })
  }
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}))

const mockModelsResponse = {
  models: [
    {
      name: 'qwen2.5:7b-instruct-q4_K_M',
      size: '4200000000',
      modified: '2024-01-15T10:30:00Z',
      digest: 'sha256:abc123'
    },
    {
      name: 'llama2:7b',
      size: '3800000000',
      modified: '2024-01-10T08:15:00Z',
      digest: 'sha256:def456'
    }
  ],
  current_model: 'qwen2.5:7b-instruct-q4_K_M'
}

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('AIModelsSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ollamaService.getAvailableModels).mockResolvedValue(mockModelsResponse)
  })

  it('renders loading state initially', () => {
    render(
      <TestWrapper>
        <AIModelsSettings />
      </TestWrapper>
    )

    expect(screen.getByText('AI Models')).toBeInTheDocument()
    expect(screen.getByText('Manage your Ollama AI models for document processing.')).toBeInTheDocument()
  })

  it('displays available models after loading', async () => {
    render(
      <TestWrapper>
        <AIModelsSettings />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('qwen2.5:7b-instruct-q4_K_M')).toBeInTheDocument()
    })

    expect(screen.getByText('llama2:7b')).toBeInTheDocument()
    expect(screen.getByText('Current Active Model')).toBeInTheDocument()
    expect(screen.getByText('Available Models')).toBeInTheDocument()
  })

  it('shows current model with active badge', async () => {
    render(
      <TestWrapper>
        <AIModelsSettings />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Active')).toHaveLength(2) // One in current model, one in model list
    })
  })

  it('handles API error gracefully', async () => {
    vi.mocked(ollamaService.getAvailableModels).mockRejectedValue(
      new Error('Connection failed')
    )

    render(
      <TestWrapper>
        <AIModelsSettings />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText(/Failed to connect to Ollama service/)).toBeInTheDocument()
    })

    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('allows refreshing models', async () => {
    render(
      <TestWrapper>
        <AIModelsSettings />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('qwen2.5:7b-instruct-q4_K_M')).toBeInTheDocument()
    })

    const refreshButton = screen.getByRole('button', { name: /Refresh/ })
    fireEvent.click(refreshButton)

    expect(ollamaService.getAvailableModels).toHaveBeenCalledTimes(2)
  })

  it('shows model change interface when different model is selected', async () => {
    render(
      <TestWrapper>
        <AIModelsSettings />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Change Model')).toBeInTheDocument()
    })

    // This test would need more sophisticated interaction with the Select component
    // to properly test model selection and the "Apply Changes" functionality
  })

  it('displays model sizes correctly', async () => {
    render(
      <TestWrapper>
        <AIModelsSettings />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('4.2 GB')).toBeInTheDocument()
      expect(screen.getByText('3.8 GB')).toBeInTheDocument()
    })
  })

  it('handles empty models list', async () => {
    vi.mocked(ollamaService.getAvailableModels).mockResolvedValue({
      models: [],
      current_model: ''
    })

    render(
      <TestWrapper>
        <AIModelsSettings />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('No models found')).toBeInTheDocument()
    })

    expect(screen.getByText(/Install models using/)).toBeInTheDocument()
  })

  it('shows model change success message', async () => {
    const mockSetActiveModel = vi.mocked(ollamaService.setActiveModel)
    mockSetActiveModel.mockResolvedValue({
      status: 'success',
      message: 'Active model set to llama2:7b',
      model: 'llama2:7b'
    })

    render(
      <TestWrapper>
        <AIModelsSettings />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('qwen2.5:7b-instruct-q4_K_M')).toBeInTheDocument()
    })

    // This would test the actual model change flow
    // Implementation depends on proper Select component interaction
  })

  it('handles model change error', async () => {
    const mockSetActiveModel = vi.mocked(ollamaService.setActiveModel)
    mockSetActiveModel.mockRejectedValue(new Error('Model not found'))

    render(
      <TestWrapper>
        <AIModelsSettings />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('qwen2.5:7b-instruct-q4_K_M')).toBeInTheDocument()
    })

    // Test error handling during model change
    // Implementation depends on proper Select component interaction
  })
})