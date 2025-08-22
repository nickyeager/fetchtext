/**
 * Document Processing Monitor Service
 * Handles timeout detection, retry logic, and stuck document recovery
 */

import { supabase } from '@/lib/supabase';
import { UnifiedDocumentService, DocumentStatus, DocumentRecord } from './unified-document-service';

export interface ProcessingTimeouts {
  ANALYZING_TIMEOUT: number;     // 5 minutes for AI analysis
  PROCESSING_TIMEOUT: number;    // 10 minutes for extraction
  STALE_CHECK_INTERVAL: number;  // 2 minutes between checks
  MAX_RETRY_ATTEMPTS: number;    // 3 retries per document
}

export const DEFAULT_TIMEOUTS: ProcessingTimeouts = {
  ANALYZING_TIMEOUT: 5 * 60 * 1000,    // 5 minutes
  PROCESSING_TIMEOUT: 10 * 60 * 1000,  // 10 minutes  
  STALE_CHECK_INTERVAL: 2 * 60 * 1000, // 2 minutes
  MAX_RETRY_ATTEMPTS: 3
};

export interface StuckDocument {
  id: string;
  status: DocumentStatus;
  stuck_duration_ms: number;
  last_update: string;
  retry_count: number;
  metadata: any;
}

export class DocumentProcessingMonitor {
  private static instance: DocumentProcessingMonitor;
  private monitorInterval: NodeJS.Timeout | null = null;
  private timeouts: ProcessingTimeouts;
  private isMonitoring = false;

  constructor(timeouts: ProcessingTimeouts = DEFAULT_TIMEOUTS) {
    this.timeouts = timeouts;
  }

  static getInstance(timeouts?: ProcessingTimeouts): DocumentProcessingMonitor {
    if (!DocumentProcessingMonitor.instance) {
      DocumentProcessingMonitor.instance = new DocumentProcessingMonitor(timeouts);
    }
    return DocumentProcessingMonitor.instance;
  }

  /**
   * Start monitoring for stuck documents
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      console.warn('📊 Document processing monitor already running');
      return;
    }

    console.log('🚀 Starting document processing monitor...');
    this.isMonitoring = true;
    
    // Immediate check
    this.checkStuckDocuments();
    
    // Set up interval
    this.monitorInterval = setInterval(() => {
      this.checkStuckDocuments();
    }, this.timeouts.STALE_CHECK_INTERVAL);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isMonitoring = false;
    console.log('⏹️ Document processing monitor stopped');
  }

  /**
   * Check for documents stuck in processing states
   */
  private async checkStuckDocuments(): Promise<void> {
    try {
      console.log('🔍 Checking for stuck documents...');
      
      const stuckDocuments = await this.findStuckDocuments();
      
      if (stuckDocuments.length > 0) {
        console.log(`⚠️ Found ${stuckDocuments.length} stuck documents`);
        
        for (const doc of stuckDocuments) {
          await this.handleStuckDocument(doc);
        }
      } else {
        console.log('✅ No stuck documents found');
      }
    } catch (error) {
      console.error('❌ Error checking stuck documents:', error);
    }
  }

  /**
   * Find documents that have been stuck in processing states
   */
  private async findStuckDocuments(): Promise<StuckDocument[]> {
    const now = new Date();
    const analyzingCutoff = new Date(now.getTime() - this.timeouts.ANALYZING_TIMEOUT);
    const processingCutoff = new Date(now.getTime() - this.timeouts.PROCESSING_TIMEOUT);

    const { data: stuckDocs, error } = await supabase
      .from('documents')
      .select('id, processing_status, updated_at, metadata')
      .in('processing_status', ['analyzing', 'processing'])
      .or(`processing_status.eq.analyzing.and.updated_at.lt.${analyzingCutoff.toISOString()},processing_status.eq.processing.and.updated_at.lt.${processingCutoff.toISOString()}`);

    if (error) {
      console.error('Error finding stuck documents:', error);
      return [];
    }

    return (stuckDocs || []).map(doc => ({
      id: doc.id,
      status: doc.processing_status as DocumentStatus,
      stuck_duration_ms: now.getTime() - new Date(doc.updated_at).getTime(),
      last_update: doc.updated_at,
      retry_count: doc.metadata?.retry_count || 0,
      metadata: doc.metadata
    }));
  }

  /**
   * Handle a stuck document with retry logic
   */
  private async handleStuckDocument(stuckDoc: StuckDocument): Promise<void> {
    console.log(`🔧 Handling stuck document ${stuckDoc.id} (${stuckDoc.status}, stuck for ${Math.round(stuckDoc.stuck_duration_ms / 1000)}s)`);

    try {
      // Check retry limit
      if (stuckDoc.retry_count >= this.timeouts.MAX_RETRY_ATTEMPTS) {
        console.log(`❌ Document ${stuckDoc.id} exceeded retry limit, marking as failed`);
        await UnifiedDocumentService.markDocumentFailed(
          stuckDoc.id,
          `Processing failed after ${this.timeouts.MAX_RETRY_ATTEMPTS} retry attempts. Document was stuck in ${stuckDoc.status} state.`
        );
        return;
      }

      // Determine recovery strategy based on status
      switch (stuckDoc.status) {
        case DocumentStatus.ANALYZING:
          await this.retryAnalysis(stuckDoc);
          break;
        case DocumentStatus.PROCESSING:
          await this.retryProcessing(stuckDoc);
          break;
        default:
          console.warn(`Unknown stuck status: ${stuckDoc.status}`);
      }
    } catch (error) {
      console.error(`Failed to handle stuck document ${stuckDoc.id}:`, error);
      
      // If retry handling fails, mark as failed
      await UnifiedDocumentService.markDocumentFailed(
        stuckDoc.id,
        `Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Retry analysis for stuck analyzing documents
   */
  private async retryAnalysis(stuckDoc: StuckDocument): Promise<void> {
    console.log(`🔄 Retrying analysis for document ${stuckDoc.id}`);
    
    try {
      // Force retry analysis with updated metadata
      await UnifiedDocumentService.forceRetryAnalysis(stuckDoc.id);
    } catch (error) {
      console.error(`Analysis retry failed for ${stuckDoc.id}:`, error);
      throw error;
    }
  }

  /**
   * Retry processing for stuck processing documents
   */
  private async retryProcessing(stuckDoc: StuckDocument): Promise<void> {
    console.log(`🔄 Retrying processing for document ${stuckDoc.id}`);
    
    try {
      // Reset to analyzing status to restart the processing pipeline
      await UnifiedDocumentService.updateDocumentStatus(stuckDoc.id, {
        status: DocumentStatus.ANALYZING,
        metadata: {
          retry_count: stuckDoc.retry_count + 1,
          retry_reason: 'stuck_in_processing',
          previous_status: stuckDoc.status,
          retry_timestamp: new Date().toISOString(),
        }
      });
    } catch (error) {
      console.error(`Processing retry failed for ${stuckDoc.id}:`, error);
      throw error;
    }
  }

  /**
   * Get monitoring status and statistics
   */
  getMonitoringStatus(): {
    isMonitoring: boolean;
    timeouts: ProcessingTimeouts;
    nextCheckIn: number | null;
  } {
    const nextCheckIn = this.monitorInterval 
      ? this.timeouts.STALE_CHECK_INTERVAL
      : null;

    return {
      isMonitoring: this.isMonitoring,
      timeouts: this.timeouts,
      nextCheckIn
    };
  }

  /**
   * Get current stuck documents (for UI display)
   */
  async getCurrentStuckDocuments(): Promise<StuckDocument[]> {
    return await this.findStuckDocuments();
  }

  /**
   * Manually trigger stuck document check
   */
  async triggerManualCheck(): Promise<StuckDocument[]> {
    console.log('🔍 Manual stuck document check triggered');
    const stuckDocs = await this.findStuckDocuments();
    
    for (const doc of stuckDocs) {
      await this.handleStuckDocument(doc);
    }
    
    return stuckDocs;
  }

  /**
   * Force retry a specific document
   */
  async forceRetryDocument(documentId: string): Promise<void> {
    console.log(`🔧 Force retrying document ${documentId}`);
    
    const document = await UnifiedDocumentService.getDocumentById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    const metadata = document.metadata || {};
    const retryCount = metadata.retry_count || 0;

    if (retryCount >= this.timeouts.MAX_RETRY_ATTEMPTS) {
      throw new Error(`Document has exceeded maximum retry attempts (${this.timeouts.MAX_RETRY_ATTEMPTS})`);
    }

    // Reset to analyzing to restart processing
    await UnifiedDocumentService.updateDocumentStatus(documentId, {
      status: DocumentStatus.ANALYZING,
      metadata: {
        ...metadata,
        retry_count: retryCount + 1,
        retry_reason: 'manual_force_retry',
        retry_timestamp: new Date().toISOString(),
      }
    });
  }
}

// Export singleton instance
export const documentProcessingMonitor = DocumentProcessingMonitor.getInstance();