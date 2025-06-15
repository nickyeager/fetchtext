// Workflow template types for the localai-admin-dashboard frontend
// These align with the workflow_templates table in the Supabase database

export interface WorkflowNodeParameter {
  [key: string]: any;
}

export interface WorkflowNode {
  id: string; // Internal ID within the workflow definition
  type: string; // e.g., 'n8n-nodes-base.httpRequest'
  name: string; // User-defined name or default type name
  parameters: Record<string, any>;
  position?: [number, number]; // For visual rendering if needed
  credentials?: string; // or a more structured credentials object
}

export interface WorkflowConnection {
  sourceNode: string; // ID of the source node
  sourceOutput: string; // Name of the output on the source node
  targetNode: string; // ID of the target node
  targetInput: string; // Name of the input on the target node
}

export interface WorkflowTemplate {
  id: string; // Corresponds to workflow_templates.id (UUID)
  name: string; // Corresponds to workflow_templates.name
  description?: string; // Corresponds to workflow_templates.description
  category?: string; // Corresponds to template_categories.name or id
  tags?: string[]; // Corresponds to workflow_templates.tags
  
  // For N8N templates, these would be parsed from template_data.nodes and template_data.connections
  nodes?: WorkflowNode[]; 
  connections?: WorkflowConnection[];
  
  thumbnailUrl?: string; // Corresponds to workflow_templates.thumbnail_url
  complexity?: 'beginner' | 'intermediate' | 'advanced'; // Corresponds to workflow_templates.difficulty_level
  estimatedTimeMinutes?: number; // Corresponds to workflow_templates.estimated_time_minutes
  templateType: 'n8n' | 'flowise' | 'hybrid' | 'other'; // Corresponds to workflow_templates.template_type
  n8nWorkflowId?: string; // Corresponds to workflow_templates.n8n_workflow_id
  flowiseFlowId?: string; // Corresponds to workflow_templates.flowise_flow_id
  templateData?: any; // The raw JSONB content
  usageCount?: number; // Corresponds to workflow_templates.usage_count
  rating?: number; // Corresponds to workflow_templates.rating
  createdBy?: string; // Corresponds to workflow_templates.created_by
  createdAt?: string; // Corresponds to workflow_templates.created_at
  updatedAt?: string; // Corresponds to workflow_templates.updated_at
}

export interface TemplateCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  createdAt?: string;
}

export interface WorkflowInstance {
  id: string;
  templateId: string;
  projectRef?: string;
  name: string;
  configuration?: any; // User-specific configuration for this instance
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // New deployment and execution fields
  deployedWorkflowId?: string; // N8N/Flowise workflow ID after deployment
  deploymentStatus?: 'draft' | 'deploying' | 'active' | 'inactive' | 'error';
  lastExecutedAt?: string;
  executionCount?: number;
  deploymentError?: string;
  
  // Template type derived from template
  templateType?: 'n8n' | 'flowise' | 'hybrid' | 'other';
  
  // Supabase relation to template
  workflow_templates?: {
    id: string;
    name: string;
    description?: string;
    template_type: 'n8n' | 'flowise' | 'hybrid' | 'other';
    thumbnail_url?: string;
    template_data?: any;
  };
}

export interface WorkflowExecution {
  id: string;
  workflowInstanceId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  inputData?: any;
  outputData?: any;
  errorMessage?: string;
  executionTimeMs?: number;
  duration?: number; // Duration in milliseconds
  startedAt: string;
  finishedAt?: string;
  triggeredBy?: 'manual' | 'schedule' | 'webhook' | 'api';
  triggerData?: any;
  metrics?: {
    totalNodes: number;
    completedNodes: number;
    failedNodes: number;
  };
  nodeExecutions?: Array<{
    nodeId: string;
    nodeName: string;
    status: 'waiting' | 'running' | 'success' | 'error' | 'skipped';
    startedAt?: string;
    finishedAt?: string;
    duration?: number;
    errorMessage?: string;
    outputData?: any;
  }>;
}

export interface TemplateRating {
  id: string;
  templateId: string;
  userId: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: string;
}

// For state management (e.g., using Zustand or React Context)
export interface WorkflowState {
  templates: WorkflowTemplate[];
  categories: TemplateCategory[];
  isLoadingTemplates: boolean;
  isLoadingCategories: boolean;
  selectedTemplate: WorkflowTemplate | null;
  selectedCategory: string | null;
  searchQuery: string;
  filters: {
    complexity?: 'beginner' | 'intermediate' | 'advanced';
    templateType?: 'n8n' | 'flowise' | 'hybrid' | 'other';
    tags?: string[];
  };
}

// Filter and search interfaces
export interface TemplateFilters {
  category?: string;
  complexity?: 'beginner' | 'intermediate' | 'advanced';
  templateType?: 'n8n' | 'flowise' | 'hybrid' | 'other';
  tags?: string[];
  minRating?: number;
}

export interface TemplateSearchParams {
  query?: string;
  filters?: TemplateFilters;
  sortBy?: 'name' | 'rating' | 'usage_count' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}