from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import logging

logger = logging.getLogger(__name__)

# Import routers
from app.routers import health, enhanced_documents, models, google_docs, email
from app.routers import api_v1, api_keys_admin
from app.routers import integrations, billing, snowflake
from app.routers import stream
from app.routers import webhooks

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

# Configure CORS from environment variable
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
logger.info(f"CORS allowed origins: {_allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(enhanced_documents.router)
app.include_router(enhanced_documents.public_router)
app.include_router(models.router)
app.include_router(google_docs.router)
app.include_router(email.router)
app.include_router(integrations.router)
app.include_router(billing.router)
app.include_router(snowflake.router)
app.include_router(stream.router)
app.include_router(webhooks.router)

# Third-party API routers
app.include_router(api_v1.router)
app.include_router(api_keys_admin.router)

@app.on_event("startup")
async def startup_sync_template_embeddings():
    """Sync existing templates into Qdrant for vector search on startup."""
    try:
        from app.services.template_vector_service import template_vector_service
        if template_vector_service.available:
            count = await template_vector_service.sync_all_templates()
            logger.info(f"Synced {count} template embeddings to Qdrant on startup")
        else:
            logger.info("Template vector service not available — skipping startup sync")
    except Exception as e:
        logger.warning(f"Template embedding sync failed on startup (non-fatal): {e}")


@app.get("/")
async def root():
    return {
        "message": "Document Processor API",
        "version": "1.0.0",
        "status": "running"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8090)
