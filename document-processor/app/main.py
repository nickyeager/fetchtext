from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import os
from pathlib import Path

# Import routers
from app.routers import documents, health, enhanced_documents, models, google_docs, email
from app.routers import api_v1, api_keys_admin
from app.routers import integrations, billing

# Import OpenAPI configuration
from app.openapi_config import get_openapi_config, get_custom_openapi_schema, API_TAGS

# Get OpenAPI configuration
_openapi_config = get_openapi_config()

app = FastAPI(
    title=_openapi_config["title"],
    description=_openapi_config["description"],
    version=_openapi_config["version"],
    contact=_openapi_config["contact"],
    license_info=_openapi_config["license_info"],
    openapi_tags=API_TAGS,
    docs_url="/swagger",
    redoc_url="/docs",
    openapi_url="/openapi.json"
)

# Override OpenAPI schema with custom enhancements
def custom_openapi():
    return get_custom_openapi_schema(app)

app.openapi = custom_openapi

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(documents.router)
app.include_router(enhanced_documents.router)
app.include_router(models.router)
app.include_router(google_docs.router)
app.include_router(email.router)
app.include_router(integrations.router)
app.include_router(billing.router)

# Third-party API routers
app.include_router(api_v1.router)
app.include_router(api_keys_admin.router)

@app.get("/")
async def root():
    return {
        "message": "Document Processor API",
        "version": "1.0.0",
        "status": "running"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8090)
