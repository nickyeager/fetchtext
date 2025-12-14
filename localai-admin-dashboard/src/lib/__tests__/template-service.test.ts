import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TemplateService } from '../template-service'
import { supabase } from '../supabase'

// Mock the supabase module
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

describe('TemplateService', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' }
  const mockTemplate = {
    id: 'template-123',
    name: 'Test Template',
    description: 'A test template',
    templateType: 'n8n' as const,
    thumbnailUrl: 'https://example.com/thumb.png',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default auth mock
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)
  })

  describe('createWorkflowInstance', () => {
    it('should create a workflow instance from a template', async () => {
      const mockInstance = {
        id: 'instance-123',
        name: 'Test Instance',
        configuration: { key: 'value' },
        template_id: mockTemplate.id,
        created_by: mockUser.id,
        workflow_templates: {
          id: mockTemplate.id,
          name: mockTemplate.name,
          template_type: mockTemplate.templateType,
          description: mockTemplate.description,
          thumbnail_url: mockTemplate.thumbnailUrl,
        }
      }
      const instanceData = {
        name: 'Test Instance',
        configuration: { key: 'value' },
      }

      // Mock the database calls
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockInstance,
        error: null,
      })

      const mockSelect = vi.fn().mockReturnValue({
        single: mockSingle,
      })

      const mockInsert = vi.fn().mockReturnValue({
        select: mockSelect,
      })

      const mockFrom = vi.fn().mockReturnValue({
        insert: mockInsert,
      })

      vi.mocked(supabase.from).mockImplementation(mockFrom)
      vi.mocked(supabase.rpc).mockResolvedValue({ 
        data: null, 
        error: null,
        count: null,
        status: 200,
        statusText: 'OK'
      } as any)

      // Call the method
      const result = await TemplateService.createWorkflowInstance(
        mockTemplate.id,
        instanceData
      )

      // Assertions
      expect(result).toEqual(mockInstance)
      expect(supabase.auth.getUser).toHaveBeenCalled()
      expect(supabase.from).toHaveBeenCalledWith('workflow_instances')
      expect(mockInsert).toHaveBeenCalledWith({
        template_id: mockTemplate.id,
        name: instanceData.name,
        configuration: instanceData.configuration,
        created_by: mockUser.id,
      })
      expect(mockSelect).toHaveBeenCalledWith(`
        *,
        workflow_templates(id, name, template_type, description, thumbnail_url)
      `)
      expect(supabase.rpc).toHaveBeenCalledWith('increment_template_usage', {
        template_id: mockTemplate.id,
      })
    })

    it('should throw error when user is not authenticated', async () => {
      // Mock unauthenticated user
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as any)

      // Call the method and expect it to throw
      await expect(
        TemplateService.createWorkflowInstance(mockTemplate.id, {
          name: 'Test Instance',
        })
      ).rejects.toThrow('User must be authenticated to use templates')
    })

    it('should handle database errors', async () => {
      const mockError = new Error('Database error')

      // Mock database error
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: mockError,
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      // Call the method and expect it to throw
      await expect(
        TemplateService.createWorkflowInstance(mockTemplate.id, {
          name: 'Test Instance',
        })
      ).rejects.toThrow(mockError)
    })

    it('should work with minimal configuration', async () => {
      const mockInstanceId = 'instance-456'
      const mockMinimalInstance = {
        id: mockInstanceId,
        name: 'Minimal Instance',
        configuration: {},
        template_id: mockTemplate.id,
        created_by: mockUser.id,
        workflow_templates: {
          id: mockTemplate.id,
          name: mockTemplate.name,
          template_type: mockTemplate.templateType,
          description: mockTemplate.description,
          thumbnail_url: mockTemplate.thumbnailUrl,
        }
      }

      // Mock the database calls
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockMinimalInstance,
        error: null,
      })

      const mockSelect = vi.fn().mockReturnValue({
        single: mockSingle,
      })

      const mockInsert = vi.fn().mockReturnValue({
        select: mockSelect,
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)
      vi.mocked(supabase.rpc).mockResolvedValue({ 
        data: null, 
        error: null,
        count: null,
        status: 200,
        statusText: 'OK'
      } as any)

      // Call with minimal config
      const result = await TemplateService.createWorkflowInstance(
        mockTemplate.id,
        { name: 'Minimal Instance' }
      )

      expect(result).toEqual(mockMinimalInstance)
      expect(mockInsert).toHaveBeenCalledWith({
        template_id: mockTemplate.id,
        name: 'Minimal Instance',
        configuration: {},
        created_by: mockUser.id,
      })
    })
  })
})
