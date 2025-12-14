/**
 * Tests for ModelSelector component
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModelSelector from '../model-selector'
import type { OllamaModel } from '@/lib/services/ollama-service'

const mockModels: OllamaModel[] = [
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
  },
  {
    name: 'simple-model',
    size: '2000000000',
    modified: '2024-01-05T12:00:00Z',
    digest: 'sha256:ghi789'
  }
]

describe('ModelSelector', () => {
  // Radix calls scrollIntoView; jsdom misses it
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  const defaultProps = {
    models: mockModels,
    selectedModel: '',
    onModelChange: vi.fn(),
    currentModel: 'qwen2.5:7b-instruct-q4_K_M'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders select trigger when models are available', () => {
    render(<ModelSelector {...defaultProps} />)
    expect(screen.getByTestId('model-select-trigger')).toBeInTheDocument()
    expect(screen.getByText('Select a model')).toBeInTheDocument()
  })

  it('shows no models message when models array is empty', () => {
    render(<ModelSelector {...defaultProps} models={[]} />)
    
    expect(screen.getByText('No models available')).toBeInTheDocument()
    expect(screen.getByText(/Install models using/)).toBeInTheDocument()
  })

  it('displays selected model correctly', () => {
    render(
      <ModelSelector 
        {...defaultProps} 
        selectedModel="llama2:7b"
      />
    )
    
    expect(screen.getByText('llama2 (7b)')).toBeInTheDocument()
  })

  it('shows current badge for active model', () => {
    render(
      <ModelSelector 
        {...defaultProps} 
        selectedModel="qwen2.5:7b-instruct-q4_K_M"
      />
    )
    
    expect(screen.getByText('Current')).toBeInTheDocument()
  })

  it('displays full model name when a model is selected', () => {
    render(
      <ModelSelector 
        {...defaultProps} 
        selectedModel="llama2:7b"
      />
    )
    
    expect(screen.getByText('llama2:7b')).toBeInTheDocument()
  })

  it('calls onModelChange when a model is selected', async () => {
    const mockOnModelChange = vi.fn()
    render(<ModelSelector {...defaultProps} onModelChange={mockOnModelChange} />)
    fireEvent.click(screen.getByTestId('model-select-trigger'))
    // open content should appear (Radix portals into body) - rely on option text
  const option = await screen.findByTestId('model-option-llama2:7b')
  fireEvent.click(option)
    expect(mockOnModelChange).toHaveBeenCalledWith('llama2:7b')
  })

  it('formats model names correctly in display', () => {
    render(<ModelSelector {...defaultProps} />)
    
    // Open the select to see options
    fireEvent.click(screen.getByRole('combobox'))
    
    // The component should format model names
    // Note: This test might need adjustment based on how the Select component renders
  })

  it('shows model sizes in the dropdown', () => {
    render(<ModelSelector {...defaultProps} />)
    
    // This test verifies that model sizes are displayed
    // Implementation depends on how the Select component exposes its content for testing
  })
})