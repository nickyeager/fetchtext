from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
import asyncio
import os
from typing import Dict, Any

from ..config.settings import settings

router = APIRouter(tags=["health"])

@router.get("/health", status_code=200)
@router.get("/health/", status_code=200, include_in_schema=False)
async def health_check() -> Dict[str, Any]:
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "service": "document-processor",
        "version": "1.0.0"
    }

@router.get("/health/ready", status_code=200)
@router.get("/health/ready/", status_code=200, include_in_schema=False)
async def readiness_check() -> Dict[str, Any]:
    """Readiness check — reports status of all critical dependencies."""
    from ..config.database import db_config

    checks: Dict[str, Any] = {}
    degraded: list[str] = []

    # Docling (document processing engine)
    try:
        import docling  # noqa: F401
        checks["docling"] = True
    except ImportError:
        checks["docling"] = False
        degraded.append("docling")

    # Azure OpenAI (LLM for extraction)
    azure_ok = settings.is_azure_configured()
    checks["azure_openai"] = azure_ok
    if not azure_ok:
        missing = []
        if not settings.AZURE_OPENAI_API_KEY:
            missing.append("AZURE_OPENAI_API_KEY")
        if not settings.AZURE_OPENAI_ENDPOINT:
            missing.append("AZURE_OPENAI_ENDPOINT")
        if not settings.AZURE_OPENAI_DEPLOYMENT_NAME:
            missing.append("AZURE_OPENAI_DEPLOYMENT_NAME")
        checks["azure_openai_missing"] = missing
        degraded.append("azure_openai")

    # Supabase / database
    db_ok = db_config.is_configured
    checks["database"] = db_ok
    if not db_ok:
        degraded.append("database")

    # Qdrant (vector search)
    try:
        from ..services.template_vector_service import template_vector_service
        qdrant_ok = template_vector_service.available
    except Exception:
        qdrant_ok = False
    checks["qdrant"] = qdrant_ok
    if not qdrant_ok:
        degraded.append("qdrant")

    all_critical_ok = azure_ok and db_ok and checks.get("docling", False)

    if all_critical_ok and not degraded:
        status = "ready"
    elif all_critical_ok:
        status = "degraded"
    else:
        status = "not_ready"

    response = {
        "status": status,
        "checks": checks,
        "service": "document-processor",
    }
    if degraded:
        response["degraded"] = degraded

    status_code = 200 if status in ("ready", "degraded") else 503
    if status_code != 200:
        return JSONResponse(status_code=status_code, content=response)
    return response

@router.get("/health/qdrant", status_code=200)
@router.get("/health/qdrant/", status_code=200, include_in_schema=False)
async def qdrant_check() -> Dict[str, Any]:
    """Live Qdrant connectivity test — performs a real operation against Qdrant."""
    try:
        from ..services.template_vector_service import template_vector_service

        if not template_vector_service.available or not template_vector_service.client:
            return JSONResponse(status_code=503, content={
                "status": "unavailable",
                "detail": "Qdrant client not connected",
            })

        client = template_vector_service.client
        collections = client.get_collections().collections
        collection_info = {}
        for c in collections:
            try:
                info = client.get_collection(c.name)
                collection_info[c.name] = {
                    "points_count": info.points_count,
                    "status": str(info.status),
                }
            except Exception as e:
                collection_info[c.name] = {"error": str(e)}

        return {
            "status": "connected",
            "host": os.getenv("QDRANT_HOST", "qdrant"),
            "port": os.getenv("QDRANT_PORT", "6333"),
            "collections_count": len(collections),
            "collections": collection_info,
        }
    except Exception as e:
        return JSONResponse(status_code=503, content={
            "status": "error",
            "detail": str(e),
        })

@router.get("/health/cors", status_code=200)
@router.get("/health/cors/", status_code=200, include_in_schema=False)
async def cors_check() -> Dict[str, Any]:
    """CORS configuration diagnostic endpoint"""
    raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    return {
        "status": "ok",
        "allowed_origins": origins,
        "allowed_origins_count": len(origins),
    }

@router.get("/health/live", status_code=200)
@router.get("/health/live/", status_code=200, include_in_schema=False)
async def liveness_check() -> Dict[str, Any]:
    """Liveness check - basic endpoint to ensure service is running"""
    return {
        "status": "alive",
        "service": "document-processor"
    }
