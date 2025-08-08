/**
 * Ollama service for managing AI models
 */

export interface OllamaModel {
  name: string;
  size: string;
  modified: string;
  digest: string;
}

export interface ModelsResponse {
  models: OllamaModel[];
  current_model: string;
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

class OllamaService {
  private baseUrl = 'http://localhost:8090'; // Document processor URL

  /**
   * Fetch all available Ollama models
   */
  async getAvailableModels(): Promise<ModelsResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/models/`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      // Log error for debugging
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch available models:', error);
      }
      throw new Error('Failed to fetch available models. Please check if the document processor is running.');
    }
  }

  /**
   * Set the active Ollama model
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
      // Log error for debugging
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
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
      // Log error for debugging
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('Failed to get current model:', error);
      }
      throw new Error('Failed to get current model. Please check if the document processor is running.');
    }
  }

  /**
   * Format model size for display
   */
  formatModelSize(size: string): string {
    if (!size || size === 'Unknown') return 'Unknown';
    
    // Convert bytes to human readable format
    const bytes = parseInt(size);
    if (isNaN(bytes)) return size;
    
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
  getModelDisplayName(model: OllamaModel): string {
    const parts = model.name.split(':');
    if (parts.length > 1) {
      return `${parts[0]} (${parts[1]})`;
    }
    return model.name;
  }
}

// Export singleton instance
export const ollamaService = new OllamaService();
export default ollamaService;