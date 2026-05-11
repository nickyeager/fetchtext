/**
 * Document Processing Queue Service
 * Manages priority-based document processing queue for high-volume scenarios
 */

import { supabase } from '@/lib/supabase';
import { UnifiedDocumentService, DocumentStatus, DocumentRecord } from './unified-document-service';

export enum ProcessingPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4,
  CRITICAL = 5
}

export interface QueuedDocument {
  id: string;
  documentId: string;
  priority: ProcessingPriority;
  queuedAt: string;
  processingStartedAt?: string;
  estimatedCompletionTime?: string;
  retryCount: number;
  maxRetries: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  metadata: {
    templateId?: number;
    processingMethod: string;
    uploadSource: string;
    estimatedProcessingTime?: number;
    dependencies?: string[];
  };
}

export interface QueueStats {
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  averageWaitTime: number;
  averageProcessingTime: number;
  throughputPerHour: number;
  priorityDistribution: Record<ProcessingPriority, number>;
}

export interface ProcessingCapacity {
  maxConcurrent: number;
  currentActive: number;
  availableSlots: number;
  avgProcessingTime: number;
}

export class DocumentProcessingQueue {
  private static instance: DocumentProcessingQueue;
  private processingQueue: Map<string, QueuedDocument> = new Map();
  private activeProcessing: Set<string> = new Set();
  private maxConcurrentProcessing: number = 3; // Default concurrent limit
  private processingInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrentProcessing = maxConcurrent;
  }

  static getInstance(maxConcurrent?: number): DocumentProcessingQueue {
    if (!DocumentProcessingQueue.instance) {
      DocumentProcessingQueue.instance = new DocumentProcessingQueue(maxConcurrent);
    }
    return DocumentProcessingQueue.instance;
  }

  /**
   * Add document to processing queue with priority
   */
  async enqueueDocument(
    documentId: string,
    priority: ProcessingPriority = ProcessingPriority.NORMAL,
    metadata: QueuedDocument['metadata']
  ): Promise<QueuedDocument> {
    const queueId = `queue_${documentId}_${Date.now()}`;
    
    const queuedDoc: QueuedDocument = {
      id: queueId,
      documentId,
      priority,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      status: 'queued',
      metadata: {
        estimatedProcessingTime: this.estimateProcessingTime(metadata),
        ...metadata
      }
    };

    this.processingQueue.set(queueId, queuedDoc);
    
    console.log(`📥 Document ${documentId} enqueued with priority ${priority}`);
    
    // Trigger processing if queue is running
    if (this.isRunning) {
      this.processNextInQueue();
    }

    return queuedDoc;
  }

  /**
   * Start the processing queue
   */
  startQueue(): void {
    if (this.isRunning) {
      console.warn('🔄 Processing queue already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting document processing queue...');
    
    // Process queue every 2 seconds
    this.processingInterval = setInterval(() => {
      this.processNextInQueue();
    }, 2000);
    
    // Initial processing
    this.processNextInQueue();
  }

  /**
   * Stop the processing queue
   */
  stopQueue(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isRunning = false;
    console.log('⏹️ Document processing queue stopped');
  }

  /**
   * Process next document in queue based on priority
   */
  private async processNextInQueue(): Promise<void> {
    // Check if we have capacity
    if (this.activeProcessing.size >= this.maxConcurrentProcessing) {
      return; // At capacity
    }

    // Get next highest priority queued document
    const nextDoc = this.getNextQueuedDocument();
    if (!nextDoc) {
      return; // No documents to process
    }

    try {
      await this.processDocument(nextDoc);
    } catch (error) {
      console.error(`❌ Failed to process document ${nextDoc.documentId}:`, error);
      await this.handleProcessingError(nextDoc, error);
    }
  }

  /**
   * Get next document to process based on priority and queue time
   */
  private getNextQueuedDocument(): QueuedDocument | null {
    const queuedDocs = Array.from(this.processingQueue.values())
      .filter(doc => doc.status === 'queued')
      .sort((a, b) => {
        // First sort by priority (higher first)
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        // Then by queue time (earlier first)
        return new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime();
      });

    return queuedDocs[0] || null;
  }

  /**
   * Process a single document
   */
  private async processDocument(queuedDoc: QueuedDocument): Promise<void> {
    console.log(`🔄 Processing document ${queuedDoc.documentId} (Priority: ${queuedDoc.priority})`);
    
    // Mark as processing
    queuedDoc.status = 'processing';
    queuedDoc.processingStartedAt = new Date().toISOString();
    this.activeProcessing.add(queuedDoc.documentId);

    try {
      // Get the document
      const document = await UnifiedDocumentService.getDocumentById(queuedDoc.documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Determine processing method based on metadata
      if (queuedDoc.metadata.templateId) {
        // Template-based processing
        await this.processWithTemplate(document, queuedDoc);
      } else {
        // Generic AI analysis
        await this.processWithAI(document, queuedDoc);
      }

      // Mark as completed
      queuedDoc.status = 'completed';
      this.processingQueue.delete(queuedDoc.id);
      
      console.log(`✅ Document ${queuedDoc.documentId} processing completed`);

    } catch (error) {
      console.error(`❌ Document processing failed:`, error);
      throw error;
    } finally {
      this.activeProcessing.delete(queuedDoc.documentId);
    }
  }

  /**
   * Process document with template
   */
  private async processWithTemplate(document: DocumentRecord, queuedDoc: QueuedDocument): Promise<void> {
    // Update document status to processing with template info
    await UnifiedDocumentService.updateDocumentStatus(document.id, {
      status: DocumentStatus.PROCESSING,
      metadata: {
        queue_processed: true,
        queue_priority: queuedDoc.priority,
        template_id: queuedDoc.metadata.templateId,
        processing_method: 'template_guided'
      }
    });

    // The UnifiedDocumentService will handle the rest via triggerTemplateExtraction
  }

  /**
   * Process document with AI analysis
   */
  private async processWithAI(document: DocumentRecord, queuedDoc: QueuedDocument): Promise<void> {
    // Update document status to analyzing
    await UnifiedDocumentService.updateDocumentStatus(document.id, {
      status: DocumentStatus.ANALYZING,
      metadata: {
        queue_processed: true,
        queue_priority: queuedDoc.priority,
        processing_method: 'ai_analysis'
      }
    });

    // The UnifiedDocumentService will handle the rest via triggerAIAnalysis
  }

  /**
   * Handle processing errors with retry logic
   */
  private async handleProcessingError(queuedDoc: QueuedDocument, error: any): Promise<void> {
    queuedDoc.retryCount++;
    
    if (queuedDoc.retryCount >= queuedDoc.maxRetries) {
      console.log(`❌ Document ${queuedDoc.documentId} exceeded retry limit, marking as failed`);
      queuedDoc.status = 'failed';
      
      // Mark document as failed in database
      await UnifiedDocumentService.markDocumentFailed(
        queuedDoc.documentId,
        `Queue processing failed after ${queuedDoc.maxRetries} retries: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      
      this.processingQueue.delete(queuedDoc.id);
    } else {
      console.log(`🔄 Retrying document ${queuedDoc.documentId} (attempt ${queuedDoc.retryCount}/${queuedDoc.maxRetries})`);
      queuedDoc.status = 'queued';
      
      // Add exponential backoff delay
      const delayMs = Math.pow(2, queuedDoc.retryCount) * 1000; // 2s, 4s, 8s...
      setTimeout(() => {
        if (this.isRunning) {
          this.processNextInQueue();
        }
      }, delayMs);
    }
  }

  /**
   * Estimate processing time based on document metadata
   */
  private estimateProcessingTime(metadata: QueuedDocument['metadata']): number {
    let baseTime = 30000; // 30 seconds base

    // Adjust based on processing method
    switch (metadata.processingMethod) {
      case 'template_guided':
        baseTime = 20000; // Faster with template
        break;
      case 'ai_enhanced':
        baseTime = 60000; // Slower with AI
        break;
      case 'progressive':
        baseTime = 45000; // Medium with progressive
        break;
    }

    // Add template complexity factor
    if (metadata.templateId) {
      baseTime *= 0.8; // 20% faster with template
    }

    return baseTime;
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): QueueStats {
    const docs = Array.from(this.processingQueue.values());
    
    const stats: QueueStats = {
      total: docs.length,
      queued: docs.filter(d => d.status === 'queued').length,
      processing: docs.filter(d => d.status === 'processing').length,
      completed: docs.filter(d => d.status === 'completed').length,
      failed: docs.filter(d => d.status === 'failed').length,
      averageWaitTime: this.calculateAverageWaitTime(docs),
      averageProcessingTime: this.calculateAverageProcessingTime(docs),
      throughputPerHour: this.calculateThroughput(docs),
      priorityDistribution: this.getPriorityDistribution(docs)
    };

    return stats;
  }

  /**
   * Get processing capacity information
   */
  getProcessingCapacity(): ProcessingCapacity {
    return {
      maxConcurrent: this.maxConcurrentProcessing,
      currentActive: this.activeProcessing.size,
      availableSlots: this.maxConcurrentProcessing - this.activeProcessing.size,
      avgProcessingTime: this.calculateAverageProcessingTime(Array.from(this.processingQueue.values()))
    };
  }

  /**
   * Update concurrent processing limit
   */
  setMaxConcurrentProcessing(limit: number): void {
    this.maxConcurrentProcessing = Math.max(1, Math.min(limit, 10)); // Between 1-10
    console.log(`🔧 Max concurrent processing updated to ${this.maxConcurrentProcessing}`);
  }

  /**
   * Get queue status for monitoring
   */
  getQueueStatus(): {
    isRunning: boolean;
    queueLength: number;
    activeProcessing: number;
    capacity: ProcessingCapacity;
    stats: QueueStats;
  } {
    return {
      isRunning: this.isRunning,
      queueLength: Array.from(this.processingQueue.values()).filter(d => d.status === 'queued').length,
      activeProcessing: this.activeProcessing.size,
      capacity: this.getProcessingCapacity(),
      stats: this.getQueueStats()
    };
  }

  /**
   * Remove document from queue
   */
  removeFromQueue(documentId: string): boolean {
    for (const [queueId, doc] of this.processingQueue.entries()) {
      if (doc.documentId === documentId && doc.status === 'queued') {
        this.processingQueue.delete(queueId);
        console.log(`🗑️ Document ${documentId} removed from queue`);
        return true;
      }
    }
    return false;
  }

  /**
   * Clear completed and failed documents from queue
   */
  cleanupQueue(): number {
    let removed = 0;
    for (const [queueId, doc] of this.processingQueue.entries()) {
      if (doc.status === 'completed' || doc.status === 'failed') {
        this.processingQueue.delete(queueId);
        removed++;
      }
    }
    console.log(`🧹 Cleaned up ${removed} completed/failed documents from queue`);
    return removed;
  }

  // Helper methods for statistics
  private calculateAverageWaitTime(docs: QueuedDocument[]): number {
    const queuedDocs = docs.filter(d => d.status === 'processing' && d.processingStartedAt);
    if (queuedDocs.length === 0) return 0;
    
    const totalWaitTime = queuedDocs.reduce((sum, doc) => {
      const waitTime = new Date(doc.processingStartedAt!).getTime() - new Date(doc.queuedAt).getTime();
      return sum + waitTime;
    }, 0);
    
    return totalWaitTime / queuedDocs.length;
  }

  private calculateAverageProcessingTime(docs: QueuedDocument[]): number {
    const completedDocs = docs.filter(d => d.metadata.estimatedProcessingTime);
    if (completedDocs.length === 0) return 30000; // Default 30s
    
    const totalTime = completedDocs.reduce((sum, doc) => sum + (doc.metadata.estimatedProcessingTime || 0), 0);
    return totalTime / completedDocs.length;
  }

  private calculateThroughput(docs: QueuedDocument[]): number {
    const completed = docs.filter(d => d.status === 'completed');
    if (completed.length === 0) return 0;
    
    // Calculate documents per hour based on recent completions
    return completed.length; // Simplified calculation
  }

  private getPriorityDistribution(docs: QueuedDocument[]): Record<ProcessingPriority, number> {
    const distribution: Record<ProcessingPriority, number> = {
      [ProcessingPriority.LOW]: 0,
      [ProcessingPriority.NORMAL]: 0,
      [ProcessingPriority.HIGH]: 0,
      [ProcessingPriority.URGENT]: 0,
      [ProcessingPriority.CRITICAL]: 0
    };

    docs.forEach(doc => {
      distribution[doc.priority]++;
    });

    return distribution;
  }
}

// Export singleton instance
export const documentProcessingQueue = DocumentProcessingQueue.getInstance();