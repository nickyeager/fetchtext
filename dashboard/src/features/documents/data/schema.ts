import { z } from 'zod'

// Document schema based on existing database structure
export const documentSchema = z.object({
  id: z.number(),
  uuid: z.string().uuid(),
  name: z.string().min(1, "Document name is required"),
  file_path: z.string(),
  file_type: z.string(),
  file_size: z.number().positive(),
  content_text: z.string().nullable(),
  metadata: z.record(z.any()).default({}),
  uploaded_by: z.string().uuid(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Document = z.infer<typeof documentSchema>

// Template variable schema
export const templateVariableSchema = z.object({
  name: z.string(),
  type: z.enum(['text', 'number', 'date', 'boolean', 'select']),
  required: z.boolean().default(false),
  default_value: z.any().optional(),
  options: z.array(z.string()).optional(), // For select type
  description: z.string().optional(),
})

// Template schema based on existing database structure
export const templateSchema = z.object({
  id: z.number(),
  uuid: z.string().uuid(),
  name: z.string().min(1, "Template name is required"),
  description: z.string().nullable(),
  template_content: z.string().min(1, "Template content is required"),
  template_type: z.enum(['markdown', 'html', 'latex', 'plain']),
  variables: z.array(templateVariableSchema).default([]),
  is_public: z.boolean().default(false),
  created_by: z.string().uuid(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Template = z.infer<typeof templateSchema>
export type TemplateVariable = z.infer<typeof templateVariableSchema>

// Generated output schema
export const generatedOutputSchema = z.object({
  id: z.number(),
  uuid: z.string().uuid(),
  document_id: z.number(),
  template_id: z.number(),
  generated_content: z.string(),
  generation_settings: z.record(z.any()).default({}),
  status: z.enum(['generating', 'completed', 'failed']),
  created_by: z.string().uuid(),
  created_at: z.coerce.date(),
})

export type GeneratedOutput = z.infer<typeof generatedOutputSchema>

// Collaboration event schema
export const collaborationEventSchema = z.object({
  id: z.number(),
  template_id: z.number(),
  user_id: z.string().uuid(),
  event_type: z.enum(['cursor_move', 'text_edit', 'selection_change']),
  event_data: z.record(z.any()),
  timestamp: z.coerce.date(),
})

export type CollaborationEvent = z.infer<typeof collaborationEventSchema>

// Processing job schema
export const processingJobSchema = z.object({
  id: z.number(),
  document_id: z.number(),
  template_id: z.number(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  progress: z.number().min(0).max(100),
  error_message: z.string().nullable(),
  processing_settings: z.record(z.any()).default({}),
  created_by: z.string().uuid(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type ProcessingJob = z.infer<typeof processingJobSchema>

export const documentListSchema = z.array(documentSchema)
export const templateListSchema = z.array(templateSchema) 