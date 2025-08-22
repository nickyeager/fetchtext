import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock the services
const mockGetTemplates = vi.fn()
const mockGetTemplateAutoDetect = vi.fn()
const mockIsSmartTemplate = vi.fn()

vi.mock('@/services/master-template-service', () => ({
  masterTemplateService: {
    getTemplates: mockGetTemplates,
  },
}))

vi.mock('@/services/unified-template-service', () => ({
  unifiedTemplateService: {
    getTemplateAutoDetect: mockGetTemplateAutoDetect,
    isSmartTemplate: mockIsSmartTemplate,
  },
}))

// Mock router
const mockNavigate = vi.fn()
const mockUseParams = vi.fn()
const mockUseSearch = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => ({
    useParams: mockUseParams,
    useSearch: mockUseSearch,
  }),
  useNavigate: () => mockNavigate,
}))

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Simple test component that simulates template editing behavior
function TestTemplateComponent() {
  const [isEditing, setIsEditing] = React.useState(false)
  const [template, setTemplate] = React.useState<any>(null)
  const [renderCount, setRenderCount] = React.useState(0)

  // Track renders to detect infinite loops
  React.useEffect(() => {
    setRenderCount(prev => prev + 1)
  })

  // Simulate template loading
  React.useEffect(() => {
    const loadTemplate = async () => {
      try {
        const templateId = mockUseParams().templateId
        if (templateId) {
          const result = await mockGetTemplateAutoDetect(Number(templateId))
          setTemplate(result)
        }
      } catch (error) {
        console.error('Error loading template:', error)
      }
    }

    loadTemplate()
  }, [])

  const handleEditClick = React.useCallback(() => {
    setIsEditing(true)
  }, [])

  const handleCancelEdit = React.useCallback(() => {
    setIsEditing(false)
  }, [])

  if (!template) {
    return <div data-testid="loading">Loading...</div>
  }

  return (
    <div data-testid="template-component">
      <div data-testid="render-count">{renderCount}</div>
      <h1 data-testid="template-name">{template.name}</h1>
      <p data-testid="template-description">{template.description}</p>
      
      {!isEditing ? (
        <div data-testid="view-mode">
          <button 
            data-testid="edit-button" 
            onClick={handleEditClick}
          >
            Edit Template
          </button>
        </div>
      ) : (
        <div data-testid="edit-mode">
          <input 
            data-testid="edit-name-input"
            defaultValue={template.name}
          />
          <button 
            data-testid="cancel-button"
            onClick={handleCancelEdit}
          >
            Cancel
          </button>
          <button data-testid="save-button">
            Save
          </button>
        </div>
      )}
    </div>
  )
}

describe('Template Edit Infinite Loop Tests', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    vi.clearAllMocks()
    
    // Setup default mocks
    mockUseParams.mockReturnValue({ templateId: '1' })
    mockUseSearch.mockReturnValue({ mode: 'view' })
    mockIsSmartTemplate.mockReturnValue(false)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    )
  }

  it('should render template properly when ID is passed in', async () => {
    const mockTemplate = {
      id: 1,
      name: 'Test Template',
      description: 'A test template for testing',
      category: 'test',
      type: 'standard'
    }

    mockGetTemplateAutoDetect.mockResolvedValue(mockTemplate)

    renderWithQueryClient(<TestTemplateComponent />)

    // Should show loading initially
    expect(screen.getByTestId('loading')).toBeInTheDocument()

    // Wait for template to load
    await waitFor(() => {
      expect(screen.getByTestId('template-component')).toBeInTheDocument()
    })

    // Check template data is displayed
    expect(screen.getByTestId('template-name')).toHaveTextContent('Test Template')
    expect(screen.getByTestId('template-description')).toHaveTextContent('A test template for testing')
    expect(screen.getByTestId('view-mode')).toBeInTheDocument()
    expect(screen.getByTestId('edit-button')).toBeInTheDocument()

    // Verify template service was called correctly
    expect(mockGetTemplateAutoDetect).toHaveBeenCalledWith(1)
  })

  it('should not cause infinite re-renders when edit button is clicked', async () => {
    const mockTemplate = {
      id: 1,
      name: 'Test Template',
      description: 'A test template for testing',
      category: 'test',
      type: 'standard'
    }

    mockGetTemplateAutoDetect.mockResolvedValue(mockTemplate)

    renderWithQueryClient(<TestTemplateComponent />)

    // Wait for template to load
    await waitFor(() => {
      expect(screen.getByTestId('template-component')).toBeInTheDocument()
    })

    // Get initial render count
    const initialRenderCount = parseInt(screen.getByTestId('render-count').textContent || '0')

    // Click edit button
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-button'))
    })

    // Should switch to edit mode
    await waitFor(() => {
      expect(screen.getByTestId('edit-mode')).toBeInTheDocument()
    })

    expect(screen.getByTestId('edit-name-input')).toBeInTheDocument()
    expect(screen.getByTestId('cancel-button')).toBeInTheDocument()
    expect(screen.getByTestId('save-button')).toBeInTheDocument()

    // Wait a bit to ensure no additional renders occur
    await new Promise(resolve => setTimeout(resolve, 100))

    // Check that render count hasn't grown excessively
    const finalRenderCount = parseInt(screen.getByTestId('render-count').textContent || '0')
    
    // Allow for reasonable number of renders (initial + template load + edit state change)
    // Should be less than 10 renders for a simple state change
    expect(finalRenderCount - initialRenderCount).toBeLessThan(10)
  })

  it('should handle edit mode cancellation without infinite loops', async () => {
    const mockTemplate = {
      id: 1,
      name: 'Test Template',
      description: 'A test template for testing',
      category: 'test',
      type: 'standard'
    }

    mockGetTemplateAutoDetect.mockResolvedValue(mockTemplate)

    renderWithQueryClient(<TestTemplateComponent />)

    // Wait for template to load
    await waitFor(() => {
      expect(screen.getByTestId('template-component')).toBeInTheDocument()
    })

    // Enter edit mode
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-button'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('edit-mode')).toBeInTheDocument()
    })

    const beforeCancelRenderCount = parseInt(screen.getByTestId('render-count').textContent || '0')

    // Cancel edit mode
    await act(async () => {
      fireEvent.click(screen.getByTestId('cancel-button'))
    })

    // Should return to view mode
    await waitFor(() => {
      expect(screen.getByTestId('view-mode')).toBeInTheDocument()
    })

    // Wait a bit to ensure stability
    await new Promise(resolve => setTimeout(resolve, 100))

    const afterCancelRenderCount = parseInt(screen.getByTestId('render-count').textContent || '0')
    
    // Should not have excessive renders during cancel
    expect(afterCancelRenderCount - beforeCancelRenderCount).toBeLessThan(5)
  })

  it('should detect infinite loops if they occur', async () => {
    // Create a component that intentionally causes infinite re-renders
    function BadComponent() {
      const [count, setCount] = React.useState(0)
      
      // This would cause infinite loop - don't do this!
      React.useEffect(() => {
        setCount(prev => prev + 1)
      }, [count]) // Dependency on count causes infinite loop

      return <div data-testid="bad-component">Count: {count}</div>
    }

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      renderWithQueryClient(<BadComponent />)
      
      // Wait and expect an error to be thrown by React
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Maximum update depth exceeded')
        )
      }, { timeout: 1000 })
    } catch (error) {
      // React should throw an error for infinite loops
      expect(error.message).toContain('Maximum update depth exceeded')
    } finally {
      consoleSpy.mockRestore()
    }
  })

  it('should handle template loading errors gracefully', async () => {
    mockGetTemplateAutoDetect.mockRejectedValue(new Error('Template not found'))

    renderWithQueryClient(<TestTemplateComponent />)

    // Should show loading initially
    expect(screen.getByTestId('loading')).toBeInTheDocument()

    // Should remain in loading state when template fetch fails
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Component should still be mounted and stable
    expect(screen.getByTestId('loading')).toBeInTheDocument()
    
    // Verify no excessive renders occurred even with error
    // (Component should not try to re-fetch infinitely)
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('should handle rapid edit button clicks without issues', async () => {
    const mockTemplate = {
      id: 1,
      name: 'Test Template',
      description: 'A test template for testing',
      category: 'test',
      type: 'standard'
    }

    mockGetTemplateAutoDetect.mockResolvedValue(mockTemplate)

    renderWithQueryClient(<TestTemplateComponent />)

    // Wait for template to load
    await waitFor(() => {
      expect(screen.getByTestId('template-component')).toBeInTheDocument()
    })

    const editButton = screen.getByTestId('edit-button')
    
    // Rapidly click edit button multiple times
    await act(async () => {
      fireEvent.click(editButton)
      fireEvent.click(editButton)
      fireEvent.click(editButton)
    })

    // Should still enter edit mode correctly
    await waitFor(() => {
      expect(screen.getByTestId('edit-mode')).toBeInTheDocument()
    })

    // Cancel and try again
    await act(async () => {
      fireEvent.click(screen.getByTestId('cancel-button'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('view-mode')).toBeInTheDocument()
    })

    // Should still be stable after rapid interactions
    const finalRenderCount = parseInt(screen.getByTestId('render-count').textContent || '0')
    expect(finalRenderCount).toBeLessThan(20) // Should not have excessive renders
  })
})