# Document Processor API Endpoints

## Base URL
`http://localhost:8090`

## API Endpoints Overview

### 🏠 Root Endpoint
- **GET** `/` - API root information

### 🩺 Health Endpoints
- **GET** `/health/` - Basic health check
- **GET** `/health/ready` - Readiness check (dependencies available)
- **GET** `/health/live` - Liveness check (service running)

### 📄 Document Processing Endpoints

#### Single Document Processing
- **POST** `/documents/upload` - Upload and process a single document
  - **Parameters**: 
    - `file` (form-data): Document file to upload
    - `extract_text` (query, optional): Extract text content (default: true)
    - `extract_metadata` (query, optional): Extract document metadata (default: true) 
    - `extract_structure` (query, optional): Extract document structure/layout (default: false)
  - **Response**: `DocumentProcessingResponse` with job_id
  - **Supported formats**: PDF, DOCX, PPTX, HTML, MD, TXT

- **GET** `/documents/status/{job_id}` - Get processing status of a document
  - **Response**: `DocumentProcessingStatus` with progress and status

- **GET** `/documents/result/{job_id}` - Get processing result of completed document
  - **Response**: Full processing result with extracted content

#### Batch Document Processing
- **POST** `/documents/batch` - Process multiple documents (max 10)
  - **Parameters**: 
    - `files` (form-data): Multiple document files
    - `extract_text`, `extract_metadata`, `extract_structure` (query params)
  - **Response**: `BatchProcessingResponse` with batch_id and job_ids

- **GET** `/documents/batch/status/{batch_id}` - Get batch processing status
  - **Response**: Batch status with individual job statuses

#### Cleanup
- **DELETE** `/documents/cleanup/{job_id}` - Clean up temporary files and job data

## Request/Response Models

### DocumentProcessingResponse
```json
{
  "job_id": "uuid-string",
  "status": "processing|completed|failed", 
  "filename": "document.pdf",
  "message": "Processing status message",
  "created_at": "2025-07-06T19:30:00"
}
```

### DocumentProcessingStatus
```json
{
  "job_id": "uuid-string",
  "status": "pending|processing|completed|failed",
  "progress": 75.5,
  "message": "Current processing message",
  "filename": "document.pdf",
  "result": null,
  "error": null
}
```

### Processing Result
```json
{
  "job_id": "uuid-string",
  "status": "completed",
  "metadata": {
    "filename": "document.pdf",
    "file_size": 12345,
    "mime_type": "application/pdf",
    "document_type": "pdf",
    "page_count": 5,
    "created_at": "2025-07-06T10:30:00",
    "title": "Document Title"
  },
  "content": {
    "text": "Extracted text content...",
    "markdown": "# Document Title\\n\\nExtracted content...",
    "tables": [
      {
        "table_id": "table_1",
        "rows": 3,
        "columns": 2,
        "data": [["Header1", "Header2"], ["Row1Col1", "Row1Col2"]]
      }
    ],
    "layout_info": {
      "pages": 5,
      "layout_detected": true,
      "reading_order": ["header", "body", "footer"]
    }
  },
  "processing_time": 2.34,
  "created_at": "2025-07-06T19:30:00",
  "completed_at": "2025-07-06T19:30:02"
}
```

### BatchProcessingResponse
```json
{
  "batch_id": "uuid-string",
  "job_ids": ["job1-uuid", "job2-uuid"],
  "total_files": 2,
  "status": "processing",
  "message": "Batch processing started"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "detail": "Unsupported file type: .xyz. Supported types: .pdf, .docx, .pptx, .html, .md, .txt"
}
```

### 404 Not Found
```json
{
  "detail": "Job ID not found"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Error processing file: [error details]"
}
```

## Usage Examples

### Upload Single Document
```bash
curl -X POST "http://localhost:8090/documents/upload" \
  -F "file=@document.pdf" \
  -F "extract_text=true" \
  -F "extract_metadata=true"
```

### Check Processing Status
```bash
curl "http://localhost:8090/documents/status/job-uuid-here"
```

### Get Processing Result
```bash
curl "http://localhost:8090/documents/result/job-uuid-here"
```

### Batch Upload
```bash
curl -X POST "http://localhost:8090/documents/batch" \
  -F "files=@doc1.pdf" \
  -F "files=@doc2.docx" \
  -F "extract_text=true"
```

### Health Check
```bash
curl "http://localhost:8090/health/"
```

## API Documentation
Interactive API documentation is available at:
- **Swagger UI**: `http://localhost:8090/docs`
- **ReDoc**: `http://localhost:8090/redoc`
