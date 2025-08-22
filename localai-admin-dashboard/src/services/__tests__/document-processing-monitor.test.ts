/**
 * Document Processing Monitor Tests
 * Tests for stuck document detection, retry logic, and timeout handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DocumentProcessingMonitor, DEFAULT_TIMEOUTS, StuckDocument } from '../document-processing-monitor';
import { DocumentStatus } from '../unified-document-service';

// Mock external dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          or: vi.fn(() => ({
            data: [],
            error: null
          }))
        }))
      }))
    }))
  }
}));

vi.mock('../unified-document-service', () => ({
  UnifiedDocumentService: {
    markDocumentFailed: vi.fn(),
    forceRetryAnalysis: vi.fn(),
    updateDocumentStatus: vi.fn(),
    getDocumentById: vi.fn()
  },
  DocumentStatus: {
    UPLOADED: 'uploaded',
    ANALYZING: 'analyzing',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed'
  }
}));

describe('DocumentProcessingMonitor', () => {
  let monitor: DocumentProcessingMonitor;
  let mockSetInterval: ReturnType<typeof vi.fn>;
  let mockClearInterval: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock timers
    mockSetInterval = vi.fn();
    mockClearInterval = vi.fn();
    global.setInterval = mockSetInterval;
    global.clearInterval = mockClearInterval;
    
    monitor = new DocumentProcessingMonitor();
  });

  afterEach(() => {
    monitor.stopMonitoring();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should create monitor with default timeouts', () => {
      const status = monitor.getMonitoringStatus();
      
      expect(status.isMonitoring).toBe(false);
      expect(status.timeouts).toEqual(DEFAULT_TIMEOUTS);
      expect(status.nextCheckIn).toBeNull();
    });

    it('should create monitor with custom timeouts', () => {
      const customTimeouts = {
        ...DEFAULT_TIMEOUTS,
        ANALYZING_TIMEOUT: 10000,
        PROCESSING_TIMEOUT: 20000
      };
      
      const customMonitor = new DocumentProcessingMonitor(customTimeouts);
      const status = customMonitor.getMonitoringStatus();
      
      expect(status.timeouts.ANALYZING_TIMEOUT).toBe(10000);
      expect(status.timeouts.PROCESSING_TIMEOUT).toBe(20000);
    });

    it('should return singleton instance', () => {
      const instance1 = DocumentProcessingMonitor.getInstance();
      const instance2 = DocumentProcessingMonitor.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Monitoring Control', () => {
    it('should start monitoring correctly', () => {
      monitor.startMonitoring();
      
      const status = monitor.getMonitoringStatus();
      expect(status.isMonitoring).toBe(true);
      expect(mockSetInterval).toHaveBeenCalledOnce();
      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        DEFAULT_TIMEOUTS.STALE_CHECK_INTERVAL
      );
    });

    it('should not start monitoring if already running', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      monitor.startMonitoring();
      monitor.startMonitoring(); // Second call
      
      expect(consoleSpy).toHaveBeenCalledWith('📊 Document processing monitor already running');
      expect(mockSetInterval).toHaveBeenCalledOnce();
      
      consoleSpy.mockRestore();
    });

    it('should stop monitoring correctly', () => {
      const mockIntervalId = 123;
      mockSetInterval.mockReturnValue(mockIntervalId);
      
      monitor.startMonitoring();
      monitor.stopMonitoring();
      
      const status = monitor.getMonitoringStatus();
      expect(status.isMonitoring).toBe(false);
      expect(mockClearInterval).toHaveBeenCalledWith(mockIntervalId);
    });
  });

  describe('Stuck Document Detection', () => {
    it('should identify stuck analyzing documents', async () => {
      const { supabase } = await import('@/lib/supabase');
      
      const mockStuckDoc = {
        id: 'doc-1',
        processing_status: 'analyzing',
        updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
        metadata: { retry_count: 0 }
      };

      // @ts-ignore - Mock the chained methods
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [mockStuckDoc],
              error: null
            })
          })
        })
      });

      const stuckDocs = await monitor.getCurrentStuckDocuments();
      
      expect(stuckDocs).toHaveLength(1);
      expect(stuckDocs[0]).toMatchObject({
        id: 'doc-1',
        status: 'analyzing',
        retry_count: 0
      });
      expect(stuckDocs[0].stuck_duration_ms).toBeGreaterThan(9 * 60 * 1000); // More than 9 minutes
    });

    it('should identify stuck processing documents', async () => {
      const { supabase } = await import('@/lib/supabase');
      
      const mockStuckDoc = {
        id: 'doc-2',
        processing_status: 'processing',
        updated_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
        metadata: { retry_count: 1 }
      };

      // @ts-ignore - Mock the chained methods
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [mockStuckDoc],
              error: null
            })
          })
        })
      });

      const stuckDocs = await monitor.getCurrentStuckDocuments();
      
      expect(stuckDocs).toHaveLength(1);
      expect(stuckDocs[0]).toMatchObject({
        id: 'doc-2',
        status: 'processing',
        retry_count: 1
      });
      expect(stuckDocs[0].stuck_duration_ms).toBeGreaterThan(14 * 60 * 1000); // More than 14 minutes
    });

    it('should handle database errors gracefully', async () => {
      const { supabase } = await import('@/lib/supabase');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // @ts-ignore - Mock the chained methods
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Database connection failed')
            })
          })
        })
      });

      const stuckDocs = await monitor.getCurrentStuckDocuments();
      
      expect(stuckDocs).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Error finding stuck documents:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Stuck Document Recovery', () => {
    it('should retry analysis for stuck analyzing documents', async () => {
      const { UnifiedDocumentService } = await import('../unified-document-service');
      
      const stuckDoc: StuckDocument = {
        id: 'doc-1',
        status: DocumentStatus.ANALYZING,
        stuck_duration_ms: 6 * 60 * 1000, // 6 minutes
        last_update: new Date().toISOString(),
        retry_count: 0,
        metadata: {}
      };

      await monitor.forceRetryDocument('doc-1');
      
      expect(UnifiedDocumentService.updateDocumentStatus).toHaveBeenCalledWith('doc-1', {
        status: DocumentStatus.ANALYZING,
        metadata: expect.objectContaining({
          retry_count: 1,
          retry_reason: 'manual_force_retry',
          retry_timestamp: expect.any(String)
        })
      });
    });

    it('should reset processing documents to analyzing', async () => {
      const { UnifiedDocumentService } = await import('../unified-document-service');
      
      const stuckDoc: StuckDocument = {
        id: 'doc-2',
        status: DocumentStatus.PROCESSING,
        stuck_duration_ms: 12 * 60 * 1000, // 12 minutes
        last_update: new Date().toISOString(),
        retry_count: 1,
        metadata: {}
      };

      await monitor.forceRetryDocument('doc-2');
      
      expect(UnifiedDocumentService.updateDocumentStatus).toHaveBeenCalledWith('doc-2', {
        status: DocumentStatus.ANALYZING,
        metadata: expect.objectContaining({
          retry_count: 2,
          retry_reason: 'manual_force_retry',
          retry_timestamp: expect.any(String)
        })
      });
    });

    it('should mark documents as failed after max retries', async () => {
      const { UnifiedDocumentService } = await import('../unified-document-service');
      
      UnifiedDocumentService.getDocumentById.mockResolvedValue({
        id: 'doc-3',
        metadata: { retry_count: 3 } // At max retry limit
      });

      await expect(monitor.forceRetryDocument('doc-3')).rejects.toThrow(
        'Document has exceeded maximum retry attempts (3)'
      );
      
      expect(UnifiedDocumentService.updateDocumentStatus).not.toHaveBeenCalled();
    });

    it('should handle retry failures gracefully', async () => {
      const { UnifiedDocumentService } = await import('../unified-document-service');
      
      UnifiedDocumentService.getDocumentById.mockResolvedValue({
        id: 'doc-4',
        metadata: { retry_count: 1 }
      });
      
      UnifiedDocumentService.updateDocumentStatus.mockRejectedValue(
        new Error('Database update failed')
      );

      await expect(monitor.forceRetryDocument('doc-4')).rejects.toThrow('Database update failed');
    });
  });

  describe('Manual Operations', () => {
    it('should trigger manual check and handle stuck documents', async () => {
      const { supabase } = await import('@/lib/supabase');
      const { UnifiedDocumentService } = await import('../unified-document-service');
      
      const mockStuckDoc = {
        id: 'doc-1',
        processing_status: 'analyzing',
        updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        metadata: { retry_count: 0 }
      };

      // @ts-ignore - Mock the chained methods
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [mockStuckDoc],
              error: null
            })
          })
        })
      });

      const stuckDocs = await monitor.triggerManualCheck();
      
      expect(stuckDocs).toHaveLength(1);
      expect(UnifiedDocumentService.forceRetryAnalysis).toHaveBeenCalledWith('doc-1');
    });

    it('should handle empty stuck document list', async () => {
      const { supabase } = await import('@/lib/supabase');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // @ts-ignore - Mock the chained methods
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      });

      const stuckDocs = await monitor.triggerManualCheck();
      
      expect(stuckDocs).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('✅ No stuck documents found');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Timeout Configuration', () => {
    it('should use correct timeout values for different statuses', () => {
      const customTimeouts = {
        ANALYZING_TIMEOUT: 2 * 60 * 1000,    // 2 minutes
        PROCESSING_TIMEOUT: 5 * 60 * 1000,   // 5 minutes
        STALE_CHECK_INTERVAL: 30 * 1000,     // 30 seconds
        MAX_RETRY_ATTEMPTS: 2
      };
      
      const customMonitor = new DocumentProcessingMonitor(customTimeouts);
      const status = customMonitor.getMonitoringStatus();
      
      expect(status.timeouts).toEqual(customTimeouts);
    });

    it('should calculate next check time correctly', () => {
      monitor.startMonitoring();
      
      const status = monitor.getMonitoringStatus();
      expect(status.nextCheckIn).toBe(DEFAULT_TIMEOUTS.STALE_CHECK_INTERVAL);
    });
  });
});