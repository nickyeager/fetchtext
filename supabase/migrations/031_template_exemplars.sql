-- Template Exemplars: store multiple example documents per template
-- for improved vector matching (multi-exemplar scoring).

CREATE TABLE IF NOT EXISTS template_exemplars (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES smart_templates(id) ON DELETE CASCADE,
    document_name TEXT NOT NULL,
    file_path TEXT,
    exemplar_index INTEGER NOT NULL,
    text_hash TEXT,                    -- SHA-256 of extracted text (dedup)
    char_count INTEGER DEFAULT 0,
    vector_indexed BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(template_id, exemplar_index)
);

CREATE INDEX idx_template_exemplars_template_id ON template_exemplars(template_id);

-- RLS policies (follows existing pattern from smart_templates)
ALTER TABLE template_exemplars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "template_exemplars_select" ON template_exemplars;
CREATE POLICY "template_exemplars_select" ON template_exemplars
    FOR SELECT TO anon, authenticated
    USING (true);  -- All exemplars readable (templates are public by default)

DROP POLICY IF EXISTS "template_exemplars_insert" ON template_exemplars;
CREATE POLICY "template_exemplars_insert" ON template_exemplars
    FOR INSERT TO authenticated
    WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "template_exemplars_delete" ON template_exemplars;
CREATE POLICY "template_exemplars_delete" ON template_exemplars
    FOR DELETE TO authenticated
    USING (created_by = auth.uid());
