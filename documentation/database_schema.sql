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
  template_type TEXT CHECK (template_type IN ('n8n', 'flowise', 'hybrid', 'other')) NOT NULL,
  tags TEXT[],
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
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
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
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
