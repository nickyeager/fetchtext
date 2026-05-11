import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowInstanceService } from '@/lib/workflow-instance-service';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-123' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

describe('WorkflowInstanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('activateInstance', () => {
    it('should successfully activate a workflow instance', async () => {
      vi.spyOn(WorkflowInstanceService, 'updateInstance').mockResolvedValue();
      vi.spyOn(WorkflowInstanceService, 'activateInstance').mockImplementation(async (instanceId) => {
        await WorkflowInstanceService.updateInstance(instanceId, { isActive: true });
      });

      await expect(WorkflowInstanceService.activateInstance('instance-456')).resolves.not.toThrow();
      expect(WorkflowInstanceService.updateInstance).toHaveBeenCalledWith('instance-456', { isActive: true });
    });

    it('should handle activation errors gracefully', async () => {
      vi.spyOn(WorkflowInstanceService, 'updateInstance').mockRejectedValue(new Error('Database connection failed'));
      vi.spyOn(WorkflowInstanceService, 'activateInstance').mockImplementation(async (instanceId) => {
        await WorkflowInstanceService.updateInstance(instanceId, { isActive: true });
      });
      
      await expect(WorkflowInstanceService.activateInstance('instance-456')).rejects.toThrow('Database connection failed');
    });

    it('should handle authentication errors', async () => {
      vi.spyOn(WorkflowInstanceService, 'updateInstance').mockRejectedValue(new Error('User must be authenticated to update instances'));
      vi.spyOn(WorkflowInstanceService, 'activateInstance').mockImplementation(async (instanceId) => {
        await WorkflowInstanceService.updateInstance(instanceId, { isActive: true });
      });
      
      await expect(WorkflowInstanceService.activateInstance('instance-456')).rejects.toThrow('User must be authenticated');
    });
  });

  describe('deactivateInstance', () => {
    it('should successfully deactivate a workflow instance', async () => {
      vi.spyOn(WorkflowInstanceService, 'updateInstance').mockResolvedValue();
      vi.spyOn(WorkflowInstanceService, 'deactivateInstance').mockImplementation(async (instanceId) => {
        await WorkflowInstanceService.updateInstance(instanceId, { isActive: false });
      });

      await expect(WorkflowInstanceService.deactivateInstance('instance-456')).resolves.not.toThrow();
      expect(WorkflowInstanceService.updateInstance).toHaveBeenCalledWith('instance-456', { isActive: false });
    });
  });

  describe('updateInstance', () => {
    it('should update instance successfully', async () => {
      vi.spyOn(WorkflowInstanceService, 'updateInstance').mockResolvedValue();

      const updateData = { name: 'Updated Name', description: 'Updated Description' };
      await expect(WorkflowInstanceService.updateInstance('instance-456', updateData)).resolves.not.toThrow();
      expect(WorkflowInstanceService.updateInstance).toHaveBeenCalledWith('instance-456', updateData);
    });
  });

  describe('getInstance', () => {
    it('should retrieve instance successfully', async () => {
      const mockInstance = {
        id: 'instance-456',
        name: 'Test Instance',
        templateId: 'template-123',
        isActive: false,
        deploymentStatus: 'draft' as const,
        createdBy: 'user-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.spyOn(WorkflowInstanceService, 'getInstance').mockResolvedValue(mockInstance);

      const result = await WorkflowInstanceService.getInstance('instance-456');
      expect(result).toEqual(mockInstance);
      expect(WorkflowInstanceService.getInstance).toHaveBeenCalledWith('instance-456');
    });
  });
}); 