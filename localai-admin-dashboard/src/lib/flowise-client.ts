/**
 * Flowise API Client for chatflow management and execution
 */
export class FlowiseClient {
  private baseUrl: string;
  private apiKey?: string;

  /**
   * Create Flowise client
   * @param baseUrl - The Flowise API base URL (required, no localhost default)
   * @param apiKey - Optional API key for authentication
   */
  constructor(baseUrl: string, apiKey?: string) {
    if (!baseUrl) {
      throw new Error('FlowiseClient: baseUrl is required. Set VITE_FLOWISE_URL environment variable.');
    }
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  /**
   * Make authenticated request to Flowise API
   */
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Flowise API Error: ${errorData.message || response.statusText}`);
    }

    return response.json();
  }

  // Chatflow Management
  async getChatflows(): Promise<FlowiseChatflow[]> {
    return this.request('/chatflows');
  }

  async getChatflow(id: string): Promise<FlowiseChatflow> {
    return this.request(`/chatflows/${id}`);
  }

  async createChatflow(chatflow: FlowiseChatflowData): Promise<FlowiseChatflow> {
    return this.request('/chatflows', {
      method: 'POST',
      body: JSON.stringify(chatflow),
    });
  }

  async updateChatflow(id: string, chatflow: Partial<FlowiseChatflowData>): Promise<FlowiseChatflow> {
    return this.request(`/chatflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(chatflow),
    });
  }

  async deleteChatflow(id: string): Promise<void> {
    await this.request(`/chatflows/${id}`, {
      method: 'DELETE',
    });
  }

  // Chatflow Execution
  async executeChatflow(
    id: string, 
    question: string, 
    history?: FlowiseMessage[], 
    uploads?: any[]
  ): Promise<FlowiseResponse> {
    return this.request(`/prediction/${id}`, {
      method: 'POST',
      body: JSON.stringify({
        question,
        history: history || [],
        uploads: uploads || [],
      }),
    });
  }

  async streamChatflow(
    id: string,
    question: string,
    history?: FlowiseMessage[],
    onData?: (chunk: string) => void
  ): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/prediction/${id}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question,
        history: history || [],
        streaming: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Flowise API Error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data && data !== '[DONE]') {
              onData?.(data);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // Chatflow History
  async getChatflowHistory(id: string, sessionId?: string): Promise<FlowiseHistory[]> {
    const params = sessionId ? `?sessionId=${sessionId}` : '';
    return this.request(`/chatmessage/${id}${params}`);
  }

  async deleteChatflowHistory(id: string, sessionId?: string): Promise<void> {
    const params = sessionId ? `?sessionId=${sessionId}` : '';
    await this.request(`/chatmessage/${id}${params}`, {
      method: 'DELETE',
    });
  }

  // Node and Component Information
  async getAvailableNodes(): Promise<FlowiseNode[]> {
    return this.request('/nodes');
  }

  async getNodeDetails(nodeType: string): Promise<FlowiseNodeDetails> {
    return this.request(`/nodes/${encodeURIComponent(nodeType)}`);
  }

  async getNodeIcon(nodeType: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/nodes-icon/${encodeURIComponent(nodeType)}`);
    return response.text();
  }

  // Tools Management
  async getTools(): Promise<FlowiseTool[]> {
    return this.request('/tools');
  }

  async createTool(tool: FlowiseToolData): Promise<FlowiseTool> {
    return this.request('/tools', {
      method: 'POST',
      body: JSON.stringify(tool),
    });
  }

  async updateTool(id: string, tool: Partial<FlowiseToolData>): Promise<FlowiseTool> {
    return this.request(`/tools/${id}`, {
      method: 'PUT',
      body: JSON.stringify(tool),
    });
  }

  async deleteTool(id: string): Promise<void> {
    await this.request(`/tools/${id}`, {
      method: 'DELETE',
    });
  }

  // Credentials Management
  async getCredentials(): Promise<FlowiseCredential[]> {
    return this.request('/credentials');
  }

  async createCredential(credential: FlowiseCredentialData): Promise<FlowiseCredential> {
    return this.request('/credentials', {
      method: 'POST',
      body: JSON.stringify(credential),
    });
  }

  async updateCredential(id: string, credential: Partial<FlowiseCredentialData>): Promise<FlowiseCredential> {
    return this.request(`/credentials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(credential),
    });
  }

  async deleteCredential(id: string): Promise<void> {
    await this.request(`/credentials/${id}`, {
      method: 'DELETE',
    });
  }

  // Health Check
  async getHealth(): Promise<{ status: string }> {
    try {
      await this.request('/');
      return { status: 'healthy' };
    } catch {
      return { status: 'unhealthy' };
    }
  }

  // Utility Methods
  async validateChatflow(chatflow: FlowiseChatflowData): Promise<FlowiseValidationResult> {
    try {
      // Basic validation - check for required nodes and connections
      if (!chatflow.flowData || !chatflow.flowData.nodes || !chatflow.flowData.edges) {
        return { valid: false, errors: ['Missing required flowData structure'] };
      }

      const nodes = chatflow.flowData.nodes;
      const edges = chatflow.flowData.edges;

      if (nodes.length === 0) {
        return { valid: false, errors: ['Chatflow must contain at least one node'] };
      }

      // Check for orphaned nodes (nodes with no connections)
      const connectedNodeIds = new Set();
      edges.forEach(edge => {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
      });

      const orphanedNodes = nodes.filter(node => !connectedNodeIds.has(node.id));
      const warnings = orphanedNodes.length > 0 
        ? [`${orphanedNodes.length} node(s) are not connected`] 
        : [];

      return { valid: true, warnings };
    } catch (error) {
      return { valid: false, errors: [`Validation error: ${error}`] };
    }
  }
}

// Type definitions for Flowise API responses
export interface FlowiseChatflow {
  id: string;
  name: string;
  flowData: FlowiseFlowData;
  deployed: boolean;
  isPublic: boolean;
  apikeyid?: string;
  chatbotConfig?: any;
  createdDate: string;
  updatedDate: string;
}

export interface FlowiseChatflowData {
  name: string;
  flowData: FlowiseFlowData;
  deployed?: boolean;
  isPublic?: boolean;
  apikeyid?: string;
  chatbotConfig?: any;
}

export interface FlowiseFlowData {
  nodes: FlowiseFlowNode[];
  edges: FlowiseFlowEdge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface FlowiseFlowNode {
  id: string;
  position: { x: number; y: number };
  type: string;
  data: {
    id: string;
    label: string;
    name: string;
    version: number;
    type: string;
    baseClasses: string[];
    category: string;
    description: string;
    inputParams: any[];
    inputAnchors: any[];
    inputs: Record<string, any>;
    outputAnchors: any[];
    outputs: Record<string, any>;
    selected?: boolean;
  };
  width?: number;
  height?: number;
  selected?: boolean;
  positionAbsolute?: { x: number; y: number };
  dragging?: boolean;
}

export interface FlowiseFlowEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
  type?: string;
  data?: any;
}

export interface FlowiseResponse {
  text: string;
  question: string;
  chatId: string;
  chatMessageId: string;
  sourceDocuments?: any[];
  followUpPrompts?: string[];
}

export interface FlowiseMessage {
  message: string;
  type: 'apiMessage' | 'userMessage';
  sourceDocuments?: any[];
}

export interface FlowiseHistory {
  id: string;
  chatflowid: string;
  sessionId: string;
  message: string;
  type: 'apiMessage' | 'userMessage';
  sourceDocuments?: any[];
  createdDate: string;
}

export interface FlowiseNode {
  name: string;
  label: string;
  version: number;
  description: string;
  category: string;
  author: string;
  badge?: string;
  type: string;
}

export interface FlowiseNodeDetails extends FlowiseNode {
  inputParams: any[];
  inputAnchors: any[];
  outputAnchors: any[];
  baseClasses: string[];
}

export interface FlowiseTool {
  id: string;
  name: string;
  description: string;
  color: string;
  iconSrc?: string;
  schema?: string;
  func?: string;
  createdDate: string;
  updatedDate: string;
}

export interface FlowiseToolData {
  name: string;
  description: string;
  color: string;
  iconSrc?: string;
  schema?: string;
  func?: string;
}

export interface FlowiseCredential {
  id: string;
  name: string;
  credentialName: string;
  encryptedData: string;
  createdDate: string;
  updatedDate: string;
}

export interface FlowiseCredentialData {
  name: string;
  credentialName: string;
  plainDataObj: Record<string, any>;
}

export interface FlowiseValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}
