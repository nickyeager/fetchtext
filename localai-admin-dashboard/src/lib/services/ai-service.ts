/**
 * AI service for managing models across multiple providers
 */

import { DOCUMENT_PROCESSOR_URL } from '@/lib/api-config';

export interface AIModel {
  name: string;
  size: string | number;
  modified?: string;
  digest?: string;
  provider?: string;
}

export interface ModelsResponse {
  models: AIModel[];
  current_model: string;
  current_provider: string;
}

export interface ModelSelectionRequest {
  model_name: string;
}

export interface ModelSelectionResponse {
  status: string;
  message: string;
  model: string;
}

export interface CurrentModelResponse {
  current_model: string;
}

export interface ProviderInfo {
  name: string;
  display_name: string;
  available: boolean;
  configured: boolean;
}

export interface ProvidersResponse {
  providers: ProviderInfo[];
  current_provider: string;
}

export interface ProviderSelectionRequest {
  provider: string;
}

export interface ProviderSelectionResponse {
  status: string;
  message: string;
  provider: string;
}

export interface TestConnectionResponse {
  success: boolean;
  provider: string;
  message: string;
  details?: Record<string, any>;
}

class AIService {
  private baseUrl = DOCUMENT_PROCESSOR_URL;

  /**
   * Fetch available AI providers
   */
  async getProviders(): Promise<ProvidersResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/models/providers`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to fetch providers:', error);
      }
      throw new Error('Failed to fetch AI providers. Please check if the document processor is running.');
    }
  }

  /**
   * Set the active AI provider
   */
  async setActiveProvider(provider: string): Promise<ProviderSelectionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/models/provider/select`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to set active provider:', error);
      }
      throw error;
    }
  }

  /**
   * Fetch all available models for current provider
   */
  async getAvailableModels(): Promise<ModelsResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/models/`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to fetch available models:', error);
      }
      throw new Error('Failed to fetch available models. Please check if the document processor is running.');
    }
  }

  /**
   * Set the active model
   */
  async setActiveModel(modelName: string): Promise<ModelSelectionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/models/select`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model_name: modelName }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to set active model:', error);
      }
      throw error;
    }
  }

  /**
   * Get the currently active model
   */
  async getCurrentModel(): Promise<CurrentModelResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/models/current`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to get current model:', error);
      }
      throw new Error('Failed to get current model. Please check if the document processor is running.');
    }
  }

  /**
   * Test connection to the currently active AI provider
   */
  async testConnection(): Promise<TestConnectionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/models/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to test connection:', error);
      }
      throw error;
    }
  }

  /**
   * Format model size for display
   */
  formatModelSize(size: string | number): string {
    if (!size || size === 'Unknown' || size === 'N/A') return size as string;
    
    // Convert to number if string
    const bytes = typeof size === 'string' ? parseInt(size) : size;
    if (isNaN(bytes)) return size.toString();
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let value = bytes;
    
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Format model name for display (remove tag if present)
   */
  formatModelName(name: string): string {
    // Remove common tags like :latest, :7b, etc. for cleaner display
    return name.split(':')[0];
  }

  /**
   * Get model display name with version
   */
  getModelDisplayName(model: AIModel): string {
    const parts = model.name.split(':');
    if (parts.length > 1) {
      return `${parts[0]} (${parts[1]})`;
    }
    return model.name;
  }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;