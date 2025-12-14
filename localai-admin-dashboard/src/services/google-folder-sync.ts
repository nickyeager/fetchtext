/**
 * Google Drive Folder Sync Service
 * 
 * Manages synchronization of Google Drive folders with the document processing system
 */

export interface FolderSyncConfig {
  folder_id: string;
  folder_name: string;
  sync_enabled: boolean;
  auto_process: boolean;
  export_format: string;
  sync_frequency: 'realtime' | '15min' | '1hour' | '6hour' | '24hour';
  include_subfolders: boolean;
  file_filters?: {
    modified_after?: string;
    created_after?: string;
    exclude_patterns?: string[];
  };
}

export interface SyncStatus {
  folder_id: string;
  last_sync_time: string;
  documents_processed: number;
  documents_failed: number;
  status: 'active' | 'paused' | 'error' | 'completed';
  next_sync_time?: string;
  error_message?: string;
}

export interface SyncResult {
  success: boolean;
  processed_count: number;
  failed_count: number;
  new_documents: string[];
  updated_documents: string[];
  errors: string[];
  sync_duration_ms: number;
}

export class GoogleFolderSyncService {
  private readonly N8N_WEBHOOK_BASE = '/n8n-webhook';
  private readonly MONITOR_WEBHOOK = '/google-drive-changes';
  
  /**
   * Set up folder synchronization
   */
  async setupFolderSync(config: FolderSyncConfig): Promise<{ success: boolean; webhook_url?: string; error?: string }> {
    try {
      // 1. Validate folder access
      const validation = await this.validateFolderAccess(config.folder_id);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // 2. Store sync configuration
      const response = await fetch('/api/google-sync/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          webhook_url: `${window.location.origin}${this.N8N_WEBHOOK_BASE}${this.MONITOR_WEBHOOK}`,
          created_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to setup folder sync: ${response.statusText}`);
      }

      const result = await response.json();

      // 3. Set up Google Drive push notifications if realtime sync is enabled
      if (config.sync_frequency === 'realtime') {
        await this.setupPushNotifications(config.folder_id);
      }

      // 4. Trigger initial sync
      await this.triggerSync(config.folder_id);

      return { 
        success: true, 
        webhook_url: `${window.location.origin}${this.N8N_WEBHOOK_BASE}${this.MONITOR_WEBHOOK}`
      };

    } catch (error) {
      console.error('Error setting up folder sync:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Setup failed' 
      };
    }
  }

  /**
   * Get all configured folder syncs
   */
  async getFolderSyncs(): Promise<Array<FolderSyncConfig & SyncStatus>> {
    try {
      const response = await fetch('/api/google-sync/folders');
      if (!response.ok) {
        throw new Error(`Failed to fetch folder syncs: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching folder syncs:', error);
      return [];
    }
  }

  /**
   * Update folder sync configuration
   */
  async updateFolderSync(folderId: string, updates: Partial<FolderSyncConfig>): Promise<boolean> {
    try {
      const response = await fetch(`/api/google-sync/folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      return response.ok;
    } catch (error) {
      console.error('Error updating folder sync:', error);
      return false;
    }
  }

  /**
   * Manually trigger a sync for a specific folder
   */
  async triggerSync(folderId: string): Promise<SyncResult> {
    try {
      const startTime = Date.now();
      
      // Call N8N workflow to trigger sync
      const response = await fetch(`${this.N8N_WEBHOOK_BASE}/manual-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          folder_id: folderId,
          trigger_type: 'manual',
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Sync trigger failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: result.success || false,
        processed_count: result.processed_count || 0,
        failed_count: result.failed_count || 0,
        new_documents: result.new_documents || [],
        updated_documents: result.updated_documents || [],
        errors: result.errors || [],
        sync_duration_ms: Date.now() - startTime
      };

    } catch (error) {
      console.error('Error triggering sync:', error);
      return {
        success: false,
        processed_count: 0,
        failed_count: 0,
        new_documents: [],
        updated_documents: [],
        errors: [error instanceof Error ? error.message : 'Sync failed'],
        sync_duration_ms: 0
      };
    }
  }

  /**
   * Pause/resume folder synchronization
   */
  async pauseSync(folderId: string, paused: boolean): Promise<boolean> {
    return this.updateFolderSync(folderId, { sync_enabled: !paused });
  }

  /**
   * Remove folder synchronization
   */
  async removeFolderSync(folderId: string): Promise<boolean> {
    try {
      // 1. Disable push notifications if active
      await this.disablePushNotifications(folderId);

      // 2. Remove sync configuration
      const response = await fetch(`/api/google-sync/folders/${folderId}`, {
        method: 'DELETE'
      });

      return response.ok;
    } catch (error) {
      console.error('Error removing folder sync:', error);
      return false;
    }
  }

  /**
   * Get sync history for a folder
   */
  async getSyncHistory(folderId: string, limit: number = 50): Promise<Array<{
    sync_time: string;
    status: string;
    documents_processed: number;
    duration_ms: number;
    error_message?: string;
  }>> {
    try {
      const response = await fetch(`/api/google-sync/folders/${folderId}/history?limit=${limit}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch sync history: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching sync history:', error);
      return [];
    }
  }

  /**
   * Extract folder ID from Google Drive folder URL
   */
  static extractFolderId(url: string): string | null {
    const patterns = [
      // Standard folder URL
      /\/folders\/([a-zA-Z0-9-_]+)/,
      // Drive URL with folder ID
      /\/drive\/folders\/([a-zA-Z0-9-_]+)/,
      // Direct folder ID
      /^([a-zA-Z0-9-_]{28,})$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Get available sync frequencies
   */
  static getSyncFrequencyOptions(): Array<{ value: string; label: string; description: string }> {
    return [
      {
        value: 'realtime',
        label: 'Real-time',
        description: 'Immediate sync when changes occur (requires webhooks)'
      },
      {
        value: '15min',
        label: 'Every 15 minutes',
        description: 'Check for changes every 15 minutes'
      },
      {
        value: '1hour',
        label: 'Hourly',
        description: 'Check for changes every hour'
      },
      {
        value: '6hour',
        label: 'Every 6 hours',
        description: 'Check for changes every 6 hours'
      },
      {
        value: '24hour',
        label: 'Daily',
        description: 'Check for changes once per day'
      }
    ];
  }

  /**
   * Validate folder access
   */
  private async validateFolderAccess(folderId: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // This would make a call to Google Drive API to check folder access
      const response = await fetch(`/api/google-sync/validate-folder/${folderId}`);
      
      if (!response.ok) {
        const error = await response.json();
        return { valid: false, error: error.message || 'Folder access validation failed' };
      }

      const result = await response.json();
      return { valid: result.valid, error: result.error };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Validation request failed' 
      };
    }
  }

  /**
   * Set up Google Drive push notifications for real-time sync
   */
  private async setupPushNotifications(folderId: string): Promise<void> {
    try {
      const response = await fetch('/api/google-sync/setup-push-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_id: folderId,
          webhook_url: `${window.location.origin}${this.N8N_WEBHOOK_BASE}${this.MONITOR_WEBHOOK}`,
          ttl: 3600000 // 1 hour in milliseconds
        })
      });

      if (!response.ok) {
        throw new Error('Failed to setup push notifications');
      }
    } catch (error) {
      console.error('Error setting up push notifications:', error);
      // Don't throw - fall back to polling
    }
  }

  /**
   * Disable Google Drive push notifications
   */
  private async disablePushNotifications(folderId: string): Promise<void> {
    try {
      await fetch('/api/google-sync/disable-push-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: folderId })
      });
    } catch (error) {
      console.error('Error disabling push notifications:', error);
      // Don't throw - this is cleanup
    }
  }
}

// Export singleton instance
export const googleFolderSync = new GoogleFolderSyncService();