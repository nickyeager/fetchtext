import { describe, it, expect } from 'vitest'
import {
  WorkflowTemplate,
  TemplateCategory,
  WorkflowInstance,
  WorkflowExecution,
  PaginatedResponse
} from '../workflows'

describe('Workflow Types', () => {
  describe('WorkflowTemplate', () => {
    it('should create a valid workflow template', () => {
      const template: WorkflowTemplate = {
        id: 'template-1',
        name: 'Test Template',
        description: 'A test template',
        category: 'automation',
        templateType: 'n8n',
        complexity: 'beginner',
        estimatedTimeMinutes: 30,
        tags: ['test', 'automation'],
        templateData: { nodes: [], connections: [] },
        thumbnailUrl: 'https://example.com/thumb.jpg',
        usageCount: 0,
        rating: 4.5,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      expect(template.id).toBe('template-1')
      expect(template.name).toBe('Test Template')
      expect(template.templateType).toBe('n8n')
      expect(template.complexity).toBe('beginner')
    })

    it('should validate template types', () => {
      const validTypes: Array<WorkflowTemplate['templateType']> = ['n8n', 'flowise', 'hybrid', 'other']
      const testTemplate: WorkflowTemplate = {
        id: 'test',
        name: 'Test',
        templateType: 'n8n'
      }
      
      expect(validTypes).toContain(testTemplate.templateType)
    })

    it('should validate complexity levels', () => {
      const validLevels: Array<WorkflowTemplate['complexity']> = ['beginner', 'intermediate', 'advanced']
      const testTemplate: WorkflowTemplate = {
        id: 'test',
        name: 'Test',
        templateType: 'n8n',
        complexity: 'beginner'
      }
      
      expect(validLevels).toContain(testTemplate.complexity)
    })
  })

  describe('TemplateCategory', () => {
    it('should create a valid template category', () => {
      const category: TemplateCategory = {
        id: 'cat-1',
        name: 'Automation',
        description: 'Automation workflows',
        icon: 'robot',
        createdAt: new Date().toISOString()
      }

      expect(category.id).toBe('cat-1')
      expect(category.name).toBe('Automation')
    })
  })

  describe('WorkflowInstance', () => {
    it('should create a valid workflow instance', () => {
      const instance: WorkflowInstance = {
        id: 'instance-1',
        templateId: 'template-1',
        name: 'My Workflow',
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      expect(instance.templateId).toBe('template-1')
      expect(instance.isActive).toBe(true)
    })
  })

  describe('WorkflowExecution', () => {
    it('should create a valid workflow execution', () => {
      const execution: WorkflowExecution = {
        id: 'exec-1',
        workflowInstanceId: 'instance-1',
        status: 'completed',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        executionTimeMs: 1500
      }

      expect(execution.workflowInstanceId).toBe('instance-1')
      expect(execution.status).toBe('completed')
      expect(execution.executionTimeMs).toBeGreaterThan(0)
    })
  })

  describe('PaginatedResponse', () => {
    it('should create a valid paginated response', () => {
      const response: PaginatedResponse<WorkflowTemplate> = {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        hasMore: false
      }

      expect(response.page).toBe(1)
      expect(response.limit).toBe(10)
      expect(Array.isArray(response.data)).toBe(true)
    })
  })
})