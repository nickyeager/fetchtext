/**
 * Google Docs Integration Service
 * 
 * Integrates with backend API to load and process Google Docs documents using user credentials
 */

// Direct backend API integration - no N8N workflow client needed

export interface GoogleDocLoadRequest {
  document_id: string;
  export_format?: 'text/plain' | 'text/html' | 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  target_folder?: string;
  process_immediately?: boolean;
}

export interface GoogleDocLoadResponse {
  success: boolean;
  message: string;
  google_doc_id: string;
  document_data?: any;
  file_data?: any;
  processed_at?: string;
  downloaded_at?: string;
  error?: string;
}

export interface GoogleDocMetadata {
  document_id: string;
  title?: string;
  created_time?: string;
  modified_time?: string;
  owner?: string;
  permissions?: string[];
  size?: number;
  export_format: string;
}

export class GoogleDocsIntegrationService {
  private readonly API_BASE_URL = '/api/google-docs';
  
  constructor() {
    // No longer using WorkflowClient - using direct backend API
  }

  /**
   * Get user's Google Drive credentials from settings
   */
  private getUserCredentials(): {
    client_id?: string;
    client_secret?: string;
    service_account_email?: string;
    service_account_key?: string;
    project_id?: string;
    auth_method: 'oauth2' | 'service_account';
    enabled: boolean;
  } | null {
    try {
      const settingsJson = localStorage.getItem('google_drive_settings');
      if (!settingsJson) return null;
      
      const settings = JSON.parse(settingsJson);
      if (!settings.enabled) return null;
      
      return settings;
    } catch (error) {
      console.error('Failed to load Google Drive settings:', error);
      return null;
    }
  }

  /**
   * Validate that user has configured Google Drive credentials
   */
  private validateCredentials(): { isValid: boolean; error?: string } {
    const credentials = this.getUserCredentials();
    
    if (!credentials) {
      return {
        isValid: false,
        error: 'Google Drive integration is not configured. Please configure it in Settings > Integrations.'
      };
    }

    if (!credentials.enabled) {
      return {
        isValid: false,
        error: 'Google Drive integration is disabled. Please enable it in Settings > Integrations.'
      };
    }

    if (credentials.auth_method === 'oauth2') {
      if (!credentials.client_id || !credentials.client_secret) {
        return {
          isValid: false,
          error: 'OAuth2 credentials are incomplete. Please check your Client ID and Client Secret in Settings > Integrations.'
        };
      }
    } else if (credentials.auth_method === 'service_account') {
      if (!credentials.service_account_key || !credentials.service_account_email) {
        return {
          isValid: false,
          error: 'Service account credentials are incomplete. Please check your service account configuration in Settings > Integrations.'
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Load a Google Doc by ID and optionally process it
   */
  async loadGoogleDoc(request: GoogleDocLoadRequest): Promise<GoogleDocLoadResponse> {
    try {
      // Validate credentials first
      const credentialsValidation = this.validateCredentials();
      if (!credentialsValidation.isValid) {
        return {
          success: false,
          message: 'Google Drive integration not configured',
          google_doc_id: request.document_id,
          error: credentialsValidation.error
        };
      }

      // Get user credentials
      const credentials = this.getUserCredentials();
      if (!credentials) {
        throw new Error('Failed to retrieve user credentials');
      }

      const requestPayload = {
        document_id: request.document_id,
        export_format: request.export_format || 'text/plain',
        target_folder: request.target_folder || 'downloaded_docs',
        process_immediately: request.process_immediately !== false, // Default to true
        // Include user's Google Drive credentials
        google_credentials: {
          auth_method: credentials.auth_method,
          client_id: credentials.client_id,
          client_secret: credentials.client_secret,
          service_account_email: credentials.service_account_email,
          service_account_key: credentials.service_account_key,
          project_id: credentials.project_id
        }
      };

      // Call backend API to load Google Doc
      const response = await fetch(`${this.API_BASE_URL}/load-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        throw new Error(`Google Docs API failed: ${response.status} ${response.statusText}`);
      }

      const result: GoogleDocLoadResponse = await response.json();
      
      return result;
    } catch (error) {
      console.error('Error loading Google Doc:', error);
      return {
        success: false,
        message: 'Failed to load Google Doc',
        google_doc_id: request.document_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Load multiple Google Docs in batch
   */
  async loadMultipleGoogleDocs(requests: GoogleDocLoadRequest[]): Promise<GoogleDocLoadResponse[]> {
    // Process documents in parallel with concurrency limit
    const BATCH_SIZE = 3; // Limit concurrent requests to avoid rate limits
    const results: GoogleDocLoadResponse[] = [];
    
    for (let i = 0; i < requests.length; i += BATCH_SIZE) {
      const batch = requests.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(request => this.loadGoogleDoc(request))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Extract Google Doc ID from various Google Docs URL formats
   */
  static extractDocumentId(url: string): string | null {
    const patterns = [
      // Standard Google Docs URL
      /\/document\/d\/([a-zA-Z0-9-_]+)/,
      // Edit URL
      /\/document\/d\/([a-zA-Z0-9-_]+)\/edit/,
      // View URL
      /\/document\/d\/([a-zA-Z0-9-_]+)\/view/,
      // Direct document ID (if just the ID is provided)
      /^([a-zA-Z0-9-_]{44})$/
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
   * Validate Google Doc access before attempting to load
   */
  async validateDocumentAccess(documentId: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Validate credentials first
      const credentialsValidation = this.validateCredentials();
      if (!credentialsValidation.isValid) {
        return { valid: false, error: credentialsValidation.error };
      }

      // Get user credentials
      const credentials = this.getUserCredentials();
      if (!credentials) {
        return { valid: false, error: 'Failed to retrieve user credentials' };
      }

      // Basic format validation
      if (!documentId || documentId.length < 20) {
        return { valid: false, error: 'Invalid document ID format' };
      }

      // Call backend API to validate access
      const response = await fetch(`${this.API_BASE_URL}/validate-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          document_id: documentId,
          google_credentials: {
            auth_method: credentials.auth_method,
            client_id: credentials.client_id,
            client_secret: credentials.client_secret,
            service_account_email: credentials.service_account_email,
            service_account_key: credentials.service_account_key,
            project_id: credentials.project_id
          }
        })
      });

      if (!response.ok) {
        return { valid: false, error: `Validation failed: ${response.statusText}` };
      }

      const result = await response.json();
      return { valid: result.valid, error: result.error };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Access validation failed' 
      };
    }
  }

  /**
   * Get supported export formats for Google Docs
   */
  static getSupportedExportFormats(): Array<{ value: string; label: string; description: string }> {
    return [
      {
        value: 'text/plain',
        label: 'Plain Text',
        description: 'Simple text format, good for basic processing'
      },
      {
        value: 'text/html',
        label: 'HTML',
        description: 'Preserves formatting and structure'
      },
      {
        value: 'application/pdf',
        label: 'PDF',
        description: 'Exact visual representation'
      },
      {
        value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        label: 'MS Word',
        description: 'Microsoft Word format (.docx)'
      }
    ];
  }

  /**
   * Create a processing pipeline for Google Docs
   */
  async createGoogleDocsProcessingPipeline(options: {
    documentIds: string[];
    exportFormat?: string;
    templateId?: string;
    processWithAI?: boolean;
    extractFields?: string[];
  }): Promise<{ pipelineId: string; status: string }> {
    const requests: GoogleDocLoadRequest[] = options.documentIds.map(id => ({
      document_id: id,
      export_format: options.exportFormat as any || 'text/plain',
      process_immediately: options.processWithAI !== false
    }));

    try {
      const results = await this.loadMultipleGoogleDocs(requests);
      
      return {
        pipelineId: `pipeline-${Date.now()}`,
        status: results.every(r => r.success) ? 'completed' : 'partial'
      };
    } catch (error) {
      return {
        pipelineId: `pipeline-${Date.now()}`,
        status: 'failed'
      };
    }
  }

  /**
   * Get workflow status for Google Doc loading
   */
  async getWorkflowStatus(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    try {
      // Check if N8N service is accessible
      const healthResponse = await fetch('/n8n-webhook/health', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.N8N_WEBHOOK_AUTH_TOKEN || ''}`
        }
      });

      return {
        status: healthResponse.ok ? 'healthy' : 'unhealthy',
        message: healthResponse.ok ? 'Google Docs workflow is operational' : 'N8N service unavailable'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Unable to connect to N8N workflow service'
      };
    }
  }
}

// Export singleton instance
export const googleDocsIntegration = new GoogleDocsIntegrationService();

// Export types for use in other components
export type { GoogleDocLoadRequest, GoogleDocLoadResponse, GoogleDocMetadata };