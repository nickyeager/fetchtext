/**
 * Processing Monitor Widget Tests
 * Tests for the UI component that displays stuck documents and controls monitoring
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProcessingMonitorWidget } from '../ProcessingMonitorWidget';
import { StuckDocument } from '@/services/document-processing-monitor';

// Mock the processing monitor service
vi.mock('@/services/document-processing-monitor', () => ({
  documentProcessingMonitor: {
    getMonitoringStatus: vi.fn(),
    getCurrentStuckDocuments: vi.fn(),
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn(),
    triggerManualCheck: vi.fn(),
    forceRetryDocument: vi.fn()
  }
}));

// Mock toast notifications
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

// Mock query client
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('ProcessingMonitorWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('should render the monitor widget with inactive state', async () => {
      const { documentProcessingMonitor } = await import('@/services/document-processing-monitor');
      
      // @ts-ignore
      documentProcessingMonitor.getMonitoringStatus.mockResolvedValue({
        isMonitoring: false,
        timeouts: {
          ANALYZING_TIMEOUT: 5 * 60 * 1000,
          PROCESSING_TIMEOUT: 10 * 60 * 1000,
          STALE_CHECK_INTERVAL: 2 * 60 * 1000,
          MAX_RETRY_ATTEMPTS: 3
        },
        nextCheckIn: null
      });

      // @ts-ignore
      documentProcessingMonitor.getCurrentStuckDocuments.mockResolvedValue([]);

      renderWithQueryClient(<ProcessingMonitorWidget />);

      expect(screen.getByText('Processing Monitor')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
      expect(screen.getByText('Start')).toBeInTheDocument();
    });

    it('should render the monitor widget with active state', async () => {
      const { documentProcessingMonitor } = await import('@/services/document-processing-monitor');
      
      // @ts-ignore
      documentProcessingMonitor.getMonitoringStatus.mockResolvedValue({
        isMonitoring: true,
        timeouts: {
          ANALYZING_TIMEOUT: 5 * 60 * 1000,
          PROCESSING_TIMEOUT: 10 * 60 * 1000,
          STALE_CHECK_INTERVAL: 2 * 60 * 1000,
          MAX_RETRY_ATTEMPTS: 3
        },
        nextCheckIn: 120000
      });

      // @ts-ignore
      documentProcessingMonitor.getCurrentStuckDocuments.mockResolvedValue([]);

      renderWithQueryClient(<ProcessingMonitorWidget />);

      expect(screen.getByText('Processing Monitor')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Stop')).toBeInTheDocument();
    });
  });

  describe('Monitor Controls', () => {
    it('should start monitoring when start button is clicked', async () => {
      const { documentProcessingMonitor } = await import('@/services/document-processing-monitor');
      const { toast } = await import('sonner');
      
      // @ts-ignore
      documentProcessingMonitor.getMonitoringStatus.mockResolvedValue({
        isMonitoring: false,
        timeouts: { MAX_RETRY_ATTEMPTS: 3, STALE_CHECK_INTERVAL: 120000 },
        nextCheckIn: null
      });

      // @ts-ignore
      documentProcessingMonitor.getCurrentStuckDocuments.mockResolvedValue([]);
      
      // @ts-ignore
      documentProcessingMonitor.startMonitoring.mockResolvedValue(undefined);

      renderWithQueryClient(<ProcessingMonitorWidget />);

      const startButton = screen.getByText('Start');
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(documentProcessingMonitor.startMonitoring).toHaveBeenCalled();
      });
    });

    it('should stop monitoring when stop button is clicked', async () => {
      const { documentProcessingMonitor } = await import('@/services/document-processing-monitor');
      
      // @ts-ignore
      documentProcessingMonitor.getMonitoringStatus.mockResolvedValue({
        isMonitoring: true,
        timeouts: { MAX_RETRY_ATTEMPTS: 3, STALE_CHECK_INTERVAL: 120000 },
        nextCheckIn: 120000
      });

      // @ts-ignore
      documentProcessingMonitor.getCurrentStuckDocuments.mockResolvedValue([]);
      
      // @ts-ignore
      documentProcessingMonitor.stopMonitoring.mockResolvedValue(undefined);

      renderWithQueryClient(<ProcessingMonitorWidget />);

      const stopButton = screen.getByText('Stop');
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(documentProcessingMonitor.stopMonitoring).toHaveBeenCalled();
      });
    });

    it('should trigger manual check when manual check button is clicked', async () => {
      const { documentProcessingMonitor } = await import('@/services/document-processing-monitor');
      const { toast } = await import('sonner');
      
      // @ts-ignore
      documentProcessingMonitor.getMonitoringStatus.mockResolvedValue({
        isMonitoring: true,
        timeouts: { MAX_RETRY_ATTEMPTS: 3, STALE_CHECK_INTERVAL: 120000 },
        nextCheckIn: 120000
      });

      // @ts-ignore
      documentProcessingMonitor.getCurrentStuckDocuments.mockResolvedValue([]);
      
      // @ts-ignore
      documentProcessingMonitor.triggerManualCheck.mockResolvedValue([]);

      renderWithQueryClient(<ProcessingMonitorWidget />);

      const manualCheckButton = screen.getByText('Manual Check');
      fireEvent.click(manualCheckButton);

      await waitFor(() => {
        expect(documentProcessingMonitor.triggerManualCheck).toHaveBeenCalled();
      });
    });
  });

  describe('Stuck Documents Display', () => {
    it('should display stuck documents when found', async () => {
      const { documentProcessingMonitor } = await import('@/services/document-processing-monitor');
      
      const mockStuckDocs: StuckDocument[] = [
        {
          id: 'doc-1',
          status: 'analyzing' as any,
          stuck_duration_ms: 6 * 60 * 1000, // 6 minutes
          last_update: new Date().toISOString(),
          retry_count: 1,
          metadata: {}
        },
        {
          id: 'doc-2',
          status: 'processing' as any,
          stuck_duration_ms: 12 * 60 * 1000, // 12 minutes
          last_update: new Date().toISOString(),
          retry_count: 2,
          metadata: {}
        }
      ];

      // @ts-ignore
      documentProcessingMonitor.getMonitoringStatus.mockResolvedValue({
        isMonitoring: true,
        timeouts: { MAX_RETRY_ATTEMPTS: 3, STALE_CHECK_INTERVAL: 120000 },
        nextCheckIn: 120000
      });

      // @ts-ignore
      documentProcessingMonitor.getCurrentStuckDocuments.mockResolvedValue(mockStuckDocs);

      renderWithQueryClient(<ProcessingMonitorWidget />);

      await waitFor(() => {
        expect(screen.getByText('2 Stuck Documents')).toBeInTheDocument();
        expect(screen.getByText('Doc: doc-1...')).toBeInTheDocument();
        expect(screen.getByText('Doc: doc-2...')).toBeInTheDocument();
        expect(screen.getByText('analyzing')).toBeInTheDocument();
        expect(screen.getByText('processing')).toBeInTheDocument();
      });
    });

    it('should display no stuck documents message when none found', async () => {
      const { documentProcessingMonitor } = await import('@/services/document-processing-monitor');
      
      // @ts-ignore
      documentProcessingMonitor.getMonitoringStatus.mockResolvedValue({
        isMonitoring: true,
        timeouts: { MAX_RETRY_ATTEMPTS: 3, STALE_CHECK_INTERVAL: 120000 },
        nextCheckIn: 120000
      });

      // @ts-ignore
      documentProcessingMonitor.getCurrentStuckDocuments.mockResolvedValue([]);

      renderWithQueryClient(<ProcessingMonitorWidget />);

      await waitFor(() => {
        expect(screen.getByText('No stuck documents found')).toBeInTheDocument();
      });
    });

    it('should show force retry button for documents under retry limit', async () => {
      const { documentProcessingMonitor } = await import('@/services/document-processing-monitor');
      
      const mockStuckDoc: StuckDocument = {
        id: 'doc-1',
        status: 'analyzing' as any,
        stuck_duration_ms: 6 * 60 * 1000,
        last_update: new Date().toISOString(),
        retry_count: 1, // Under limit of 3
        metadata: {}
      };

      // @ts-ignore
      documentProcessingMonitor.getMonitoringStatus.mockResolvedValue({
        isMonitoring: true,
        timeouts: { MAX_RETRY_ATTEMPTS: 3, STALE_CHECK_INTERVAL: 120000 },
        nextCheckIn: 120000
      });

      // @ts-ignore
      documentProcessingMonitor.getCurrentStuckDocuments.mockResolvedValue([mockStuckDoc]);

      renderWithQueryClient(<ProcessingMonitorWidget />);

      await waitFor(() => {
        expect(screen.getByText('Force Retry')).toBeInTheDocument();
      });
    });

    it('should not show force retry button for documents at retry limit', async () => {
      const { documentProcessingMonitor } = await import('@/services/document-processing-monitor');
      
      const mockStuckDoc: StuckDocument = {
        id: 'doc-1',
        status: 'analyzing' as any,
        stuck_duration_ms: 6 * 60 * 1000,
        last_update: new Date().toISOString(),
        retry_count: 3, // At limit
        metadata: {}
      };

      // @ts-ignore
      documentProcessingMonitor.getMonitoringStatus.mockResolvedValue({
        isMonitoring: true,
        timeouts: { MAX_RETRY_ATTEMPTS: 3, STALE_CHECK_INTERVAL: 120000 },
        nextCheckIn: 120000
      });

      // @ts-ignore
      documentProcessingMonitor.getCurrentStuckDocuments.mockResolvedValue([mockStuckDoc]);

      renderWithQueryClient(<ProcessingMonitorWidget />);

      await waitFor(() => {
        expect(screen.queryByText('Force Retry')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle monitoring start errors', async () => {
      const { documentProcessingMonitor } = await import('@/services/document-processing-monitor');
      const { toast } = await import('sonner');
      
      // @ts-ignore
      documentProcessingMonitor.getMonitoringStatus.mockResolvedValue({
        isMonitoring: false,
        timeouts: { MAX_RETRY_ATTEMPTS: 3, STALE_CHECK_INTERVAL: 120000 },
        nextCheckIn: null
      });

      // @ts-ignore
      documentProcessingMonitor.getCurrentStuckDocuments.mockResolvedValue([]);
      
      // @ts-ignore
      documentProcessingMonitor.startMonitoring.mockRejectedValue(new Error('Failed to start monitoring'));

      renderWithQueryClient(<ProcessingMonitorWidget />);

      const startButton = screen.getByText('Start');
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to start monitoring')
        );
      });
    });

    it('should handle force retry errors', async () => {
      const { documentProcessingMonitor } = await import('@/services/document-processing-monitor');
      const { toast } = await import('sonner');
      
      const mockStuckDoc: StuckDocument = {
        id: 'doc-1',
        status: 'analyzing' as any,
        stuck_duration_ms: 6 * 60 * 1000,
        last_update: new Date().toISOString(),
        retry_count: 1,
        metadata: {}
      };

      // @ts-ignore
      documentProcessingMonitor.getMonitoringStatus.mockResolvedValue({
        isMonitoring: true,
        timeouts: { MAX_RETRY_ATTEMPTS: 3, STALE_CHECK_INTERVAL: 120000 },
        nextCheckIn: 120000
      });

      // @ts-ignore
      documentProcessingMonitor.getCurrentStuckDocuments.mockResolvedValue([mockStuckDoc]);
      
      // @ts-ignore
      documentProcessingMonitor.forceRetryDocument.mockRejectedValue(new Error('Retry failed'));

      renderWithQueryClient(<ProcessingMonitorWidget />);

      await waitFor(() => {
        const retryButton = screen.getByText('Force Retry');
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('Retry failed')
        );
      });
    });
  });

  describe('Duration Formatting', () => {
    it('should format stuck duration correctly', async () => {
      const { documentProcessingMonitor } = await import('@/services/document-processing-monitor');
      
      const mockStuckDoc: StuckDocument = {
        id: 'doc-1',
        status: 'analyzing' as any,
        stuck_duration_ms: 5 * 60 * 1000 + 30 * 1000, // 5 minutes 30 seconds
        last_update: new Date().toISOString(),
        retry_count: 0,
        metadata: {}
      };

      // @ts-ignore
      documentProcessingMonitor.getMonitoringStatus.mockResolvedValue({
        isMonitoring: true,
        timeouts: { MAX_RETRY_ATTEMPTS: 3, STALE_CHECK_INTERVAL: 120000 },
        nextCheckIn: 120000
      });

      // @ts-ignore
      documentProcessingMonitor.getCurrentStuckDocuments.mockResolvedValue([mockStuckDoc]);

      renderWithQueryClient(<ProcessingMonitorWidget />);

      await waitFor(() => {
        expect(screen.getByText('Stuck: 5m 30s')).toBeInTheDocument();
      });
    });
  });

  describe('Alert for High Retry Counts', () => {
    it('should show alert when documents have high retry counts', async () => {
      const { documentProcessingMonitor } = await import('@/services/document-processing-monitor');
      
      const mockStuckDoc: StuckDocument = {
        id: 'doc-1',
        status: 'analyzing' as any,
        stuck_duration_ms: 6 * 60 * 1000,
        last_update: new Date().toISOString(),
        retry_count: 2, // High retry count
        metadata: {}
      };

      // @ts-ignore
      documentProcessingMonitor.getMonitoringStatus.mockResolvedValue({
        isMonitoring: true,
        timeouts: { MAX_RETRY_ATTEMPTS: 3, STALE_CHECK_INTERVAL: 120000 },
        nextCheckIn: 120000
      });

      // @ts-ignore
      documentProcessingMonitor.getCurrentStuckDocuments.mockResolvedValue([mockStuckDoc]);

      renderWithQueryClient(<ProcessingMonitorWidget />);

      await waitFor(() => {
        expect(screen.getByText(/Some documents are approaching the retry limit/)).toBeInTheDocument();
      });
    });
  });
});