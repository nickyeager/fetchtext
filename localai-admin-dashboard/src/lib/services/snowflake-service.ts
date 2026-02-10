/**
 * Snowflake Service
 *
 * Client for browsing Snowflake stages, listing files,
 * and downloading/processing documents.
 */

// =============================================================================
// Types
// =============================================================================

export interface SnowflakeDatabase {
  name: string
  created_on?: string
}

export interface SnowflakeSchema {
  name: string
  database: string
}

export interface SnowflakeStage {
  name: string
  database_name: string
  schema_name: string
  type: string
}

export interface SnowflakeStageFile {
  name: string
  full_path: string
  size: number
  last_modified: string
  extension: string
  is_processable: boolean
  file_category: 'document' | 'data' | 'other'
}

export interface SnowflakeDownloadResult {
  success: boolean
  job_id: string
  file_name: string
  processing_status: string
  document_data?: {
    text: string
    metadata?: Record<string, unknown>
    source: string
    file_name: string
  }
}

export interface SnowflakeBatchResult {
  success: boolean
  batch_id: string
  total_files: number
  status: string
}

export interface SnowflakeJobStatus {
  job_id: string
  status: string
  type?: string
  total?: number
  completed?: number
  failed?: number
  results?: Array<{
    file_name: string
    status: string
    error?: string
  }>
  error?: string
}

export interface SnowflakeConnectionTest {
  success: boolean
  message: string
  user_info?: {
    account: string
    user: string
    role: string
    warehouse: string
  }
}

// =============================================================================
// Configuration
// =============================================================================

const DOCUMENT_PROCESSOR_URL =
  import.meta.env.VITE_DOCUMENT_PROCESSOR_URL || 'http://localhost:8090'

// =============================================================================
// Service
// =============================================================================

class SnowflakeServiceClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = `${DOCUMENT_PROCESSOR_URL}/api/snowflake`
  }

  async testConnection(organizationId: string): Promise<SnowflakeConnectionTest> {
    const url = new URL(`${this.baseUrl}/test`)
    url.searchParams.set('organization_id', organizationId)
    const response = await fetch(url.toString())
    if (!response.ok) throw new Error(`Test failed: ${response.status}`)
    return response.json()
  }

  async listDatabases(organizationId: string): Promise<SnowflakeDatabase[]> {
    const url = new URL(`${this.baseUrl}/databases`)
    url.searchParams.set('organization_id', organizationId)
    const response = await fetch(url.toString())
    if (!response.ok) throw new Error(`Failed to list databases: ${response.status}`)
    const data = await response.json()
    return data.databases
  }

  async listSchemas(
    organizationId: string,
    database: string
  ): Promise<SnowflakeSchema[]> {
    const url = new URL(`${this.baseUrl}/schemas`)
    url.searchParams.set('organization_id', organizationId)
    url.searchParams.set('database', database)
    const response = await fetch(url.toString())
    if (!response.ok) throw new Error(`Failed to list schemas: ${response.status}`)
    const data = await response.json()
    return data.schemas
  }

  async listStages(
    organizationId: string,
    database?: string,
    schema?: string
  ): Promise<SnowflakeStage[]> {
    const url = new URL(`${this.baseUrl}/stages`)
    url.searchParams.set('organization_id', organizationId)
    if (database) url.searchParams.set('database', database)
    if (schema) url.searchParams.set('schema_name', schema)
    const response = await fetch(url.toString())
    if (!response.ok) throw new Error(`Failed to list stages: ${response.status}`)
    const data = await response.json()
    return data.stages
  }

  async listFiles(
    organizationId: string,
    stageName: string,
    options?: {
      pathPrefix?: string
      pattern?: string
      fileTypeFilter?: string
    }
  ): Promise<SnowflakeStageFile[]> {
    const url = new URL(`${this.baseUrl}/stages/${encodeURIComponent(stageName)}/files`)
    url.searchParams.set('organization_id', organizationId)
    if (options?.pathPrefix) url.searchParams.set('path_prefix', options.pathPrefix)
    if (options?.pattern) url.searchParams.set('pattern', options.pattern)
    if (options?.fileTypeFilter) url.searchParams.set('file_type_filter', options.fileTypeFilter)
    const response = await fetch(url.toString())
    if (!response.ok) throw new Error(`Failed to list files: ${response.status}`)
    const data = await response.json()
    return data.files
  }

  async downloadAndProcess(
    organizationId: string,
    stageName: string,
    filePath: string,
    options?: { processImmediately?: boolean; saveToDatabase?: boolean }
  ): Promise<SnowflakeDownloadResult> {
    const url = `${this.baseUrl}/stages/${encodeURIComponent(stageName)}/download`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: organizationId,
        file_path: filePath,
        process_immediately: options?.processImmediately ?? true,
        save_to_database: options?.saveToDatabase ?? true,
      }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `Download failed: ${response.status}`)
    }
    return response.json()
  }

  async batchDownload(
    organizationId: string,
    stageName: string,
    files: string[],
    processImmediately = true
  ): Promise<SnowflakeBatchResult> {
    const url = `${this.baseUrl}/stages/${encodeURIComponent(stageName)}/batch-download`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: organizationId,
        files,
        process_immediately: processImmediately,
      }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `Batch download failed: ${response.status}`)
    }
    return response.json()
  }

  async getDownloadStatus(jobId: string): Promise<SnowflakeJobStatus> {
    const response = await fetch(`${this.baseUrl}/download-status/${jobId}`)
    if (!response.ok) throw new Error(`Failed to get status: ${response.status}`)
    return response.json()
  }
}

// =============================================================================
// Export
// =============================================================================

export const snowflakeService = new SnowflakeServiceClient()

export const snowflakeKeys = {
  all: ['snowflake'] as const,
  databases: (orgId: string) => [...snowflakeKeys.all, 'databases', orgId] as const,
  schemas: (orgId: string, db: string) =>
    [...snowflakeKeys.all, 'schemas', orgId, db] as const,
  stages: (orgId: string, db?: string, schema?: string) =>
    [...snowflakeKeys.all, 'stages', orgId, db, schema] as const,
  files: (orgId: string, stage: string, prefix?: string) =>
    [...snowflakeKeys.all, 'files', orgId, stage, prefix] as const,
  connectionTest: (orgId: string) =>
    [...snowflakeKeys.all, 'test', orgId] as const,
}
