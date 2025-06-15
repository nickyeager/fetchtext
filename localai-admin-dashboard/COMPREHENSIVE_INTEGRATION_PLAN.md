# Comprehensive Integration Plan: Leveraging Existing Local AI Infrastructure (Updated June 12, 2025)

## Overview

This master plan leverages your existing local AI infrastructure to create a powerful template gallery and workflow automation system. It consolidates previous planning documents and reflects the current project status.

**Core Tools:**
- **N8N** (Low-code workflow automation)
- **Supabase** (Database, Auth, Vector Store)
- **Open WebUI** (Chat interface)
- **Flowise** (AI agent builder)
- **Ollama** (Local LLMs)
- **Qdrant** (Vector database)
- **Neo4j** (Knowledge graphs)
- **Langfuse** (LLM observability)
- **SearXNG** (Search engine)
- **localai-admin-dashboard** (Central UI for administration and template interaction)

## Pillar 1: Authentication Strategy (Leveraging Supabase Auth)

To ensure security and a seamless user experience, we will leverage the existing **Supabase Auth** service.

### **How It Works:**
1.  **Centralized User Management**: All users, permissions, and authentication logic will be handled by your existing Supabase instance.
2.  **Client-Side Integration**: The `localai-admin-dashboard` (a React application) will use the official `@supabase/supabase-js` library to communicate directly with the Supabase authentication endpoints.
3.  **JWT-Based Sessions**: Upon successful login, Supabase provides a JSON Web Token (JWT). This token will be stored securely in the browser and sent with every subsequent API request.

### **Implementation Steps (localai-admin-dashboard):**
1.  **Configure Environment Variables** (in `localai-admin-dashboard/.env.local`):
    ```env
    VITE_SUPABASE_URL=http://localhost:8000 # Or your production Supabase URL
    VITE_SUPABASE_ANON_KEY=your_anon_key_from_main_env
    ```
2.  **Create a Supabase Client** (e.g., `src/lib/supabase.ts`):
    ```typescript
    import { createClient } from \'@supabase/supabase-js\'

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    export const supabase = createClient(supabaseUrl, supabaseAnonKey)
    ```
3.  **Implement an Authentication Context** (e.g., `src/context/AuthContext.tsx`) to manage session state.
4.  **Create Login and Protected Routes** using a router like `@tanstack/react-router`.

## Pillar 2: Service Integration Strategy (Docker & Caddy)

The `localai-admin-dashboard` UI needs to communicate with backend services (Ollama, n8n, etc.).

### **How It Works:**
1.  **Containerization**: The `localai-admin-dashboard` is packaged in its Docker image.
2.  **Docker Networking**: All containers communicate on the same Docker network using service names.
3.  **Caddy Reverse Proxy**: Caddy routes traffic to the UI and other services, handling SSL.

### **Implementation Steps (Main `docker-compose.yml` and `Caddyfile`):**
1.  **Production-Ready `Dockerfile` for `localai-admin-dashboard`** (already exists).
2.  **Update `docker-compose.yml`** with a service definition for `localai-admin-dashboard`.
    ```yaml
    services:
      # ... other services
      localai-admin-dashboard:
        container_name: localai-admin-dashboard
        build:
          context: ./localai-admin-dashboard
          args:
            VITE_SUPABASE_URL: http://kong:8000 # Internal Docker network URL for Supabase
            VITE_SUPABASE_ANON_KEY: ${ANON_KEY} # From .env
        restart: unless-stopped
        expose:
          - 80 # Internal port Nginx in the container listens on
        networks:
          - default # Your Docker network
    ```
3.  **Update `Caddyfile`**:
    ```caddy
    admin.yourdomain.com { # Replace with your actual domain
        reverse_proxy localai-admin-dashboard:80
    }
    ```
4.  **Frontend API Calls**: UI makes calls to services via Caddy using public-facing subdomains, passing JWTs for auth.

## Phase 1: Template Gallery & Admin Dashboard Foundation (Completed - Target: Week 1-2 of original plan)

### 1.1 Enhance Supabase Schema (Definitive Version)
Extend Supabase with template and workflow management tables. This consolidated schema will reside in `documentation/database_schema.sql`.

```sql
-- Template gallery tables
CREATE TABLE template_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT, -- SVG or URL to icon
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES template_categories(id),
  n8n_workflow_id TEXT,         -- Reference to n8n workflow
  flowise_flow_id TEXT,         -- Reference to flowise chatflow
  template_type TEXT CHECK (template_type IN (\\'n8n\\', \\'flowise\\', \\'hybrid\\', \\'other\\')) NOT NULL,
  tags TEXT[],
  difficulty_level TEXT CHECK (difficulty_level IN (\\'beginner\\', \\'intermediate\\', \\'advanced\\')),
  estimated_time_minutes INTEGER,
  thumbnail_url TEXT,
  usage_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0, -- Average rating
  template_data JSONB NOT NULL, -- Stores n8n JSON, Flowise JSON, or other config
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE template_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE,
  embedding vector(1536), -- For semantic search (e.g., OpenAI embeddings)
  content TEXT,           -- Searchable content derived from template name, description, tags
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable vector search (example for pgvector)
-- CREATE INDEX ON template_embeddings USING ivfflat (embedding vector_cosine_ops);
-- Or for HNSW: CREATE INDEX ON template_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE TABLE workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES workflow_templates(id) ON DELETE SET NULL, -- Allow template to be deleted without losing instance history
  project_ref TEXT, -- If multi-project/tenant, otherwise can be NULL
  name TEXT NOT NULL,
  configuration JSONB, -- User-specific configuration for this instance
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN (\\'pending\\', \\'running\\', \\'completed\\', \\'failed\\', \\'cancelled\\')),
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  execution_time_ms INTEGER, -- Duration in milliseconds
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  finished_at TIMESTAMP WITH TIME ZONE
);

-- User ratings for templates
CREATE TABLE template_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(template_id, user_id) -- Ensure a user can only rate a template once
);

-- Function to update average rating on workflow_templates
CREATE OR REPLACE FUNCTION update_template_average_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE workflow_templates
  SET rating = (
    SELECT AVG(rating)
    FROM template_ratings
    WHERE template_id = NEW.template_id
  )
  WHERE id = NEW.template_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update average rating after a new rating is inserted or an existing one updated
CREATE TRIGGER template_ratings_after_insert_update
AFTER INSERT OR UPDATE ON template_ratings
FOR EACH ROW
EXECUTE FUNCTION update_template_average_rating();

-- Trigger to update average rating after a rating is deleted
CREATE OR REPLACE FUNCTION update_template_average_rating_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE workflow_templates
  SET rating = (
    SELECT AVG(rating)
    FROM template_ratings
    WHERE template_id = OLD.template_id
  )
  WHERE id = OLD.template_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER template_ratings_after_delete
AFTER DELETE ON template_ratings
FOR EACH ROW
EXECUTE FUNCTION update_template_average_rating_on_delete();

```

### 1.1.A Core Data Structures (Client-Side Workflow & Templates)
These TypeScript interfaces will be used in the `localai-admin-dashboard` frontend for handling workflow templates, particularly for N8N. They should align with the data stored in the `workflow_templates` table (especially the `template_data` field for N8N JSON).

```typescript
// src/types/workflows.ts (or similar path in localai-admin-dashboard)

export interface WorkflowNodeParameter {
  // Define based on common N8N node parameter structures if needed
  // For now, keeping it generic as Record<string, any> in WorkflowNode
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
  // Potentially add other fields from workflow_templates table like usage_count, rating, created_by, created_at, updated_at
}

// For state management (e.g., using Zustand or React Context)
export interface WorkflowState {
  templates: WorkflowTemplate[];
  isLoadingTemplates: boolean;
  selectedTemplate: WorkflowTemplate | null;
  // Potentially add states for workflow instances, executions, etc.
  error: string | null;
}
```

### 1.2 Admin Dashboard UI & Initial AI Chat (localai-admin-dashboard)
This phase focuses on establishing the `localai-admin-dashboard` as the central UI, initially by cloning and customizing `shadcn-admin` and integrating a core AI chat interface powered by Ollama.

**Key Activities & Deliverables:**

1.  **Project Setup & Customization:**
    *   Clone `shadcn-admin` into the `localai-admin-dashboard` directory.
    *   Analyze project structure, dependencies, routing, and theming.
    *   Configure `.env.local` with necessary environment variables (e.g., API endpoints).
    *   Initial branding and customization updates.

2.  **Core Chat Component Development:**
    *   **Component Architecture:**
        *   `ChatInterface.tsx`: Main chat container, message history, and layout.
        *   `MessageBubble.tsx`: Styling and display for individual user and AI messages.
        *   `ChatInput.tsx`: Input field with send functionality, potentially including Markdown support or command parsing.
        *   `ModelSelector.tsx`: Dropdown or selection UI for choosing available Ollama models.
        *   `LoadingIndicator.tsx`: Visual feedback during AI response generation.
    *   **Key Features:**
        *   Real-time display of messages.
        *   Selection and switching between Ollama models.
        *   Basic error handling for API communication issues.
        *   Responsive design for various screen sizes.
        *   Auto-scrolling to the latest message.
        *   Display of message timestamps.

3.  **Ollama API Integration:**
    *   Develop an `OllamaService.ts` (or similar) to encapsulate communication with the Ollama API.
    *   Implement functions for:
        *   Fetching available models (`/api/tags`).
        *   Generating text responses (`/api/generate`), initially with basic streaming if feasible.
        *   Handling API errors and providing feedback to the UI.
    *   **Service Status:** Potentially a `ServiceStatus.tsx` component to indicate Ollama service availability.

4.  **Core Data Structures (Chat - `src/types/ai.ts` or similar):**
    ```typescript
    export interface ChatMessage {
      id: string;
      role: 'user' | 'assistant' | 'system'; // Added 'system' for potential future use
      content: string;
      timestamp: Date;
      model?: string;
      metadata?: Record<string, any>;
    }

    export interface OllamaModel {
      name: string;
      model: string; // The full model identifier, e.g., "llama2:latest"
      size: number; // size in bytes
      digest: string;
      modified_at: string;
      details?: { // Optional details structure
        family: string;
        format: string;
        parameter_size: string;
        quantization_level: string;
      };
    }

    export interface ChatSession {
      id: string;
      title: string;
      messages: ChatMessage[];
      model: string; // Active model for the session
      created_at: Date;
      updated_at: Date;
    }
    ```

5.  **Testing Strategy:**
    *   **Functional Testing:** Verify chat interface loads, messages send/receive, model selection works, errors are handled.
    *   **Integration Testing:** Confirm connection to Ollama API, handling of different models, and graceful degradation if Ollama is unavailable.
    *   **Performance Metrics (Initial):** Aim for quick load times and responsive message interactions.

6.  **Documentation (Initial):**
    *   Basic user guide for the chat interface.
    *   Developer notes on component structure and Ollama integration.

**Success Criteria (for this sub-phase):**
*   Functional AI chat interface within `localai-admin-dashboard`.
*   Users can select an Ollama model and have a conversation.
*   Clean, professional UI based on `shadcn-admin` design principles.
*   Basic error handling for Ollama communication.

### 1.3 N8N Template Discovery Workflow (Initial)
- Create an N8N workflow that:
    - Scans the `n8n-tool-workflows` directory.
    - For each `.json` file:
        - Parses the workflow to extract name, nodes (for description generation), and tags (if any).
        - Stores metadata (name, description, tags, file path as `template_data ->> 'n8n_file_path'`) in the `workflow_templates` table in Supabase. Set `template_type` to 'n8n'.
        - Generates embeddings for the name and description using a local Ollama model (e.g., `mxbai-embed-large`) via an HTTP request node.
        - Stores these embeddings in the `template_embeddings` table, linked to the `workflow_templates` entry.
- This workflow can be manually triggered initially.

### 1.4 Flowise Integration (Initial)
- Manually review existing Flowise chatflows (e.g., `Web Search + n8n Agent Chatflow.json`).
- For key chatflows, manually create entries in `workflow_templates`:
    - Set `name`, `description`.
    - `template_type` = 'flowise'.
    - `template_data` = the JSON content of the chatflow.
    - Generate and store embeddings similarly to N8N templates.
- Create a basic Flowise agent (chatflow) that can query the `workflow_templates` table (via an HTTP request to a Supabase Function or PostgREST) to help users find templates based on keywords (simple string matching for now).

## Phase 2: AI-Powered Template Discovery (Week 3-4)

### 2.1 Semantic Search System
Build on your existing infrastructure:

**N8N Workflow**: "Template Search Agent"
- Input: User query via webhook
- Process: Generate embeddings using Ollama
- Search: Query Supabase vector store
- Output: Ranked template recommendations

**Flowise Agent**: "Template Discovery Assistant"
- Uses your existing custom tools
- Integrates with Neo4j for knowledge graph relationships
- Provides conversational template discovery

### 2.2 Template Recommendation Engine
**N8N Workflow**: "Smart Recommendations"
- Analyzes user's existing workflows
- Uses Neo4j to find related templates
- Tracks usage patterns in Supabase
- Sends recommendations via Open WebUI integration

## Phase X: Direct N8N Integration from Admin Dashboard 
This phase focuses on enabling the `localai-admin-dashboard` to interact directly with the N8N API for managing and executing workflows, beyond just discovery.

### X.1 N8N Client Service (`src/lib/n8nClient.ts`)
Develop a client service in the admin dashboard to communicate with the N8N API.
```typescript
// src/lib/n8nClient.ts (example structure)
export class N8nClient {
  private n8nApiUrl: string; // e.g., http://n8n.yourdomain.com/api/v1 or internal http://n8n:5678/api/v1
  private apiKey?: string; // If N8N API key is used

  constructor(apiUrl: string, apiKey?: string) {
    this.n8nApiUrl = apiUrl.replace(/\\/$/, ''); // Ensure no trailing slash
    this.apiKey = apiKey;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const headers = { ...options.headers };
    if (this.apiKey) {
      headers['X-N8N-API-KEY'] = this.apiKey;
    }
    // Add Supabase JWT for user context if N8N is protected by user-specific access
    // const token = supabase.auth.session()?.access_token;
    // if (token) {
    //   headers['Authorization'] = `Bearer ${token}`;
    // }

    const response = await fetch(`${this.n8nApiUrl}${endpoint}`, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`N8N API Error: ${errorData.message || response.statusText}`);
    }
    return response.json();
  }

  async getWorkflows(): Promise<any[]> { // Define a proper type for N8N Workflow later
    return this.request('/workflows');
  }

  async getWorkflow(id: string): Promise<any> {
    return this.request(`/workflows/${id}`);
  }

  async activateWorkflow(id: string): Promise<any> {
    return this.request(`/workflows/${id}/activate`, { method: 'POST' });
  }

  async deactivateWorkflow(id: string): Promise<any> {
    return this.request(`/workflows/${id}/deactivate`, { method: 'POST' });
  }

  async executeWorkflow(id: string, data: any): Promise<any> { // Define ExecutionResult type
    // Note: Direct execution might be complex depending on N8N setup (webhook vs. direct call)
    // This might involve calling a specific webhook URL for the workflow
    // Or using the /executions endpoint if available and appropriate
    console.warn('N8nClient.executeWorkflow: Implementation depends on N8N workflow trigger type.');
    // Example for workflows with a Webhook node as a trigger:
    // return this.request(`/webhook/${id}`, { method: 'POST', body: JSON.stringify(data), headers: {'Content-Type': 'application/json'} });
    // Or for starting saved workflows (if N8N version supports it via API):
    return this.request(`/workflows/${id}/execute`, { method: 'POST', body: JSON.stringify(data), headers: {'Content-Type': 'application/json'} });
  }

  async getExecutions(workflowId?: string): Promise<any[]> {
    const endpoint = workflowId ? `/executions?workflowId=${workflowId}` : '/executions';
    return this.request(endpoint);
  }

  // Placeholder for template-related interactions if N8N itself exposes template management API
  // async getWorkflowTemplatesFromN8nInstance(): Promise<WorkflowTemplate[]> // This is different from Supabase templates
}
```

### X.2 UI for N8N Workflow Management
*   Display list of workflows from N8N.
*   Activate/deactivate workflows.
*   View execution history.
*   Trigger workflows (for those designed with manual/API triggers).

### X.3 Credential Management (Consideration)
*   Securely handling N8N credentials if the dashboard needs to configure them. This is sensitive and might be better managed directly in N8N. The dashboard could link to the N8N UI for this.

## Phase 3: Enhanced Template Gallery UI (Week 5-6)
This phase will significantly enhance the `localai-admin-dashboard` to provide a rich user experience for browsing, searching, and interacting with workflow templates.

### 3.1 UI Components for Template Gallery
*   **`TemplateGallery.tsx`**:
    *   Main container for displaying template cards in a responsive grid (e.g., `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`).
    *   Integrates search input, filter controls, and pagination.
    *   Fetches template data from Supabase (using the `workflow_templates` table and client-side `WorkflowTemplate` type).
*   **`TemplateCard.tsx`**:
    *   Individual card for each template, built with `shadcn/ui` components (`Card`, `CardHeader`, `CardTitle`, `Badge`, `CardContent`, `CardFooter`, `Button`).
    *   Displays template name, complexity badge, description, tags.
    *   Buttons for "Use Template" (initiates instance creation or configuration) and "Preview".
*   **Filter Sidebar/Panel**:
    *   Allow filtering by category, tags, complexity, template type (N8N, Flowise).
    *   Potentially "Recently Used" or "Favorite" templates.
*   **Search Functionality**:
    *   Input field for full-text search (client-side filtering on loaded data or server-side search via Supabase functions).
    *   Leverage semantic search capabilities from "Phase 2: AI-Powered Template Discovery".

### 3.2 Template Preview Modal/Page
*   When a user clicks "Preview" on a `TemplateCard`.
*   Display detailed template information:
    *   Visual representation of the workflow (if N8N/Flowise, potentially a simplified graph or list of nodes).
    *   Node descriptions and key parameters.
    *   Required credentials or integrations.
    *   Sample input/output data (if available in `template_data`).
    *   Estimated execution time.

### 3.3 Core Gallery Features (Integrating previous ideas)
*   **Semantic Search Integration**: Fully integrate the search capabilities developed in "Phase 2: AI-Powered Template Discovery".
*   **Categorization**: Allow browsing templates by categories defined in `template_categories`.
*   **Rating System**: Implement UI for users to submit ratings and comments (linking to `template_ratings` table). Display average ratings on `TemplateCard`s.
*   **Usage Analytics Integration**: Display relevant usage statistics (e.g., usage count from `workflow_templates`) and link to more detailed analytics (potentially via Langfuse or a dedicated dashboard section).

### 3.4 Admin Dashboard Overview & Analytics Section
*   Create a dedicated section in the `localai-admin-dashboard` to provide an overview of workflow activity.
*   **Stats Cards**: Display key metrics like total templates, total workflow instances, active executions, success/failure rates (data sourced from Supabase tables `workflow_templates`, `workflow_instances`, `workflow_executions`).
*   **Recent Activity Feeds**: Show recent template additions, workflow executions.
*   **Charts**: Visualize trends in template usage, execution times, etc. (potentially using a lightweight charting library).

## Phase 4: AI-Assisted Template Creation (Week 7-8)

### 4.1 Template Generator Workflow
**N8N Workflow**: "AI Template Generator"
- Input: Natural language description
- Process: 
  - Use Ollama to understand requirements
  - Query Neo4j for similar patterns
  - Generate workflow structure
  - Create both N8N and Flowise versions
- Output: Ready-to-use template

### 4.2 Multi-Modal Template Creation
**Flowise Agent**: "Template Builder Assistant"
- Conversational interface via Open WebUI
- Guides users through template creation
- Suggests best practices from knowledge base
- Automatically tests generated workflows

## Phase Y: Visual Workflow Editor Integration (Experimental/Advanced)
This phase explores integrating a visual workflow editor into the `localai-admin-dashboard`, potentially using libraries like React Flow, to allow users to construct or modify N8N or Flowise-like workflows directly within the dashboard. This is an advanced feature and would require significant effort.

### Y.1 Core Editor Components
*   **`FlowCanvas.tsx` (using React Flow or similar):**
    *   Displays nodes and edges of a workflow.
    *   Supports drag-and-drop of nodes, connecting nodes, and arranging the layout.
    *   Handles node selection for configuration.
*   **`NodePalette.tsx`:**
    *   A sidebar or panel listing available node types (e.g., "Trigger Nodes", "Core Nodes", "HTTP Nodes", "AI Nodes").
    *   Allows dragging nodes onto the canvas.
*   **`NodeConfigurationPanel.tsx`:**
    *   Displays a form for configuring the parameters of the currently selected node.
    *   Dynamically renders input fields based on node type and its defined parameters.

### Y.2 Functionality
*   Load existing N8N/Flowise templates (from `template_data`) into the visual editor.
*   Modify node parameters, connections.
*   Add new nodes from the palette.
*   Save changes back to `template_data` in Supabase (creating a new template or a new version).
*   Validate workflow structure.

**Considerations:**
*   Complexity: Replicating full N8N/Flowise editor functionality is highly complex.
*   Scope: Initially, this could be a "viewer" with limited editing, or focus on a subset of common nodes.
*   Alternative: Deep-linking to the native N8N/Flowise editor for full editing capabilities, with the dashboard managing the template metadata and instances.

## Phase 5: Advanced Workflow Orchestration (Week 9-10)

### 5.1 Cross-Platform Workflow Execution
**N8N Master Workflow**: "Hybrid Execution Engine"
- Orchestrates between N8N and Flowise
- Routes requests based on task type
- Handles complex multi-step workflows
- Provides unified monitoring via Langfuse

### 5.2 Knowledge Graph Integration
**Neo4j Enhancements**:
- Map relationships between templates
- Track workflow dependencies
- Store execution patterns
- Enable intelligent workflow composition

## Phase 6: Community and Collaboration (Week 11-12)

### 6.1 Template Marketplace
**Supabase Extensions**:
- User profiles and template sharing
- Community ratings and reviews
- Template versioning and updates
- Usage analytics and insights

**N8N Workflows**:
- "Template Publisher" - Automated template validation and publishing
- "Community Moderator" - AI-powered content moderation
- "Usage Tracker" - Analytics and reporting

*   **Template Import/Export:**
    *   Allow users to export their custom workflow templates (from `workflow_templates` table, packaging `template_data` and metadata) as a JSON file.
    *   Allow users to import template JSON files, creating new entries in `workflow_templates`.
    *   Consider a `TemplateManager` class or service in the backend/N8N to handle parsing, validation, and storage.

### 6.2 Collaborative Features
**Real-time Collaboration**:
- Live editing sessions via Supabase Realtime
- Shared workspaces in Open WebUI
- Collaborative debugging and optimization

*   **Commenting System:** Allow users to comment on templates (could be linked to `template_ratings` or a separate table).
*   **Team/Shared Workspaces (Advanced):** If multi-tenancy or team features are introduced, allow sharing templates and workflow instances within a team.

## Deployment Strategy
This section outlines the production deployment strategy for the `localai-admin-dashboard` and its integration with the existing `local-ai-packaged` infrastructure, drawing from `integration-plans/production-deployment-strategy.md`.

### Key Principles:
*   **Caddy Reverse Proxy**: Single entry point for all services, handling HTTPS (Let's Encrypt), and domain-based routing.
*   **Dockerized Services**: All components, including the `localai-admin-dashboard`, run in Docker containers.
*   **Internal Docker Network**: Services communicate internally using Docker service names.
*   **Environment-Based Configuration**: `.env` files manage service hostnames, ports, API keys, and other settings. Production mode (`--environment public`) restricts external port exposure.

### `localai-admin-dashboard` Deployment:
1.  **Production Dockerfile (`localai-admin-dashboard/Dockerfile`):**
    *   Utilizes a multi-stage build (e.g., `node:18-alpine` for building, `nginx:alpine` for serving).
    *   Builds the React application (`pnpm run build`).
    *   Serves static assets using Nginx, configured to handle client-side routing (e.g., `try_files $uri $uri/ /index.html;`).
    *   Includes a health check endpoint (e.g., `/health`).
    *   Runs Nginx as a non-root user for security.
2.  **`docker-compose.yml` Integration:**
    *   A service definition for `shadcn-admin` (or `localai-admin-dashboard`) is added.
    *   Exposes the internal Nginx port (e.g., 3005 or 80).
    *   Configures environment variables for production API endpoints (e.g., `VITE_API_BASE_URL`, `VITE_OLLAMA_API`, `VITE_SUPABASE_URL` pointing to internal Docker service names or Caddy-proxied public URLs as appropriate for client-side vs server-side needs).
    *   Depends on other necessary services (N8N, Ollama, Supabase/Kong).
    *   Includes a Docker health check.
3.  **`Caddyfile` Configuration:**
    *   An entry for the admin dashboard's hostname (e.g., `admin.yourdomain.com`).
    *   `reverse_proxy` to the `shadcn-admin` Docker service and internal port.
    *   Recommended security headers (`X-Frame-Options`, `X-Content-Type-Options`, etc.).
    *   Optional: Basic authentication via Caddy for initial protection.
4.  **Environment Variables (`.env`):**
    *   `ADMIN_DASHBOARD_HOSTNAME` for Caddy.
    *   Production API URLs for the frontend build if they differ from development.
    *   `NODE_ENV=production`.
5.  **DNS Configuration:**
    *   An 'A' record for `admin.yourdomain.com` pointing to the server's public IP.

### Deployment Script (`deploy-production.sh` - Conceptual):
*   A shell script to automate deployment:
    *   Validates environment configuration.
    *   Builds the admin dashboard Docker image.
    *   Stops existing services (if updating).
    *   Pulls latest images for all services.
    *   Starts services using `docker-compose` with production profiles/overrides.
    *   Performs health checks.

### Security Considerations:
*   **Authentication**: Transition from optional Caddy basic auth to Supabase Auth for the admin dashboard.
*   **Firewall (UFW)**: Allow only necessary ports (80, 443, SSH).
*   **Data Protection**: SSL/TLS via Caddy, secure cookie settings, Content Security Policy (CSP) headers.

## Monitoring Strategy
This outlines the optimized monitoring stack for the LocalAI infrastructure, including the template gallery and admin dashboard, based on `MONITORING_OPTIMIZATION_GUIDE.md`. The goal is a streamlined, efficient system.

### Core Monitoring Stack Components:
*   **Prometheus**: For metrics collection.
    *   Scrapes `cAdvisor` (container metrics), `node-exporter` (system metrics), and application-specific metrics endpoints (e.g., `/metrics` from N8N, Flowise, Open WebUI, Ollama, and a dedicated `template-metrics` service).
    *   Configured via `monitoring/metrics/prometheus.yml`.
*   **Grafana**: For visualization and dashboards.
    *   Uses Prometheus and Loki as data sources.
    *   Configured via `monitoring/dashboards/datasources.yml`.
    *   Hosts dashboards for system overview, container performance, and template gallery analytics.
*   **Loki**: For log aggregation.
*   **AlertManager**: For handling alerts defined in Prometheus.
    *   Configured via `monitoring/metrics/alert_rules.yml` (e.g., alerts for `ContainerDown`, `HighCPUUsage`, `HighMemoryUsage`, `TemplateServiceDown`).
*   **cAdvisor**: Collects container runtime metrics.
*   **Node Exporter**: Collects host system metrics.
*   **Uptime Kuma**: For uptime monitoring of services via HTTP checks.
*   **Portainer**: For Docker container management UI.

### Enhanced Health Dashboard (`health_dashboard.py`):
*   A custom real-time web interface (e.g., running on port 8888).
*   Consolidates status from various services.
*   Displays template gallery metrics (N8N workflow counts, Flowise stats, template usage).
*   Monitors resource usage (CPU, memory, network, disk I/O per container).
*   Integrates health checks and alert notifications.

### Template Gallery Monitoring:
*   A dedicated `template-metrics` service/endpoint to expose metrics related to the template gallery (e.g., number of templates, categories, usage, ratings).
*   Prometheus scrapes these metrics.
*   Grafana dashboards visualize template adoption, performance, and other relevant analytics.

### Deployment:
*   The optimized monitoring stack is deployed via a dedicated Docker Compose file (e.g., `monitoring/docker-compose.optimized.yml`).

### Key Benefits:
*   Reduced resource consumption (RAM, CPU, disk) compared to potentially redundant or heavier monitoring setups.
*   Centralized and streamlined monitoring path.
*   Comprehensive visibility into system health, container performance, and application-specific metrics, including the template gallery.

## Implementation Strategy

### Leverage Existing Assets

1. **Your Current Workflows**:
   - `Local_RAG_AI_Agent_n8n_Workflow.json` becomes a flagship template
   - `Create_Google_Doc.json`, `Post_Message_to_Slack.json` etc. become starter templates
   - `Web Search + n8n Agent Chatflow.json` powers the discovery system

2. **Your Infrastructure**:
   - Supabase handles all data persistence and auth
   - N8N orchestrates workflow automation
   - Flowise provides conversational interfaces
   - Ollama powers all AI operations locally
   - Neo4j maps workflow relationships
   - Langfuse monitors everything

3. **Your Monitoring Setup**:
   - Extend existing monitoring to include template metrics
   - Use Prometheus/Grafana for template usage analytics
   - Container health checks ensure system reliability

### Development Approach

#### Week 1-2: Foundation
- Extend Supabase schema
- Import existing workflows as templates
- Create basic N8N discovery workflow

#### Week 3-4: AI Integration
- Build semantic search with Ollama
- Create Flowise discovery agent
- Implement recommendation engine

#### Week 5-6: UI Enhancement
- Extend Supabase Studio with template pages
- Build responsive template gallery
- Add preview and rating systems

#### Week 7-8: AI Creation
- Build template generator workflow
- Create conversational template builder
- Implement testing automation

#### Week 9-10: Advanced Features
- Cross-platform orchestration
- Neo4j knowledge integration
- Advanced analytics

#### Week 11-12: Community
- Template marketplace
- Collaboration features
- Documentation and tutorials

## Success Metrics

### Technical Metrics
- Template discovery accuracy (semantic search)
- Workflow execution success rate
- System performance and reliability
- User engagement with AI features

### Business Metrics
- Template usage frequency
- Community contribution rate
- Workflow automation adoption
- Developer productivity gains

## Benefits of This Approach

1. **Leverages Existing Investment**: Uses all your current tools
2. **Rapid Development**: Building on proven infrastructure
3. **Local AI First**: Everything runs on your local setup
4. **Scalable Architecture**: Each component can scale independently
5. **Community Ready**: Built for sharing and collaboration
6. **Enterprise Grade**: Monitoring, security, and reliability built-in

## Next Steps

1. **Validate Architecture**: Review with your current setup
2. **Priority Features**: Identify most valuable features first
3. **Incremental Development**: Start with one workflow type
4. **Testing Strategy**: Use your existing monitoring for validation
5. **Documentation**: Leverage your existing docs structure

This plan transforms your existing local AI infrastructure into a powerful, community-driven template gallery and workflow automation platform without requiring external dependencies or major architectural changes.
