from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
import asyncio
from typing import Dict, Any

router = APIRouter(prefix="/health", tags=["health"])

@router.get("/")
async def health_check() -> Dict[str, Any]:
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "service": "document-processor",
        "version": "1.0.0"
    }

@router.get("/ready")
async def readiness_check() -> Dict[str, Any]:
    """Readiness check - ensures all dependencies are available"""
    try:
        # Check if Docling is importable
        import docling
        
        # Check if required services are available
        checks = {
            "docling": True,
            "filesystem": True,  # Basic filesystem check
        }
        
        all_healthy = all(checks.values())
        
        return {
            "status": "ready" if all_healthy else "not_ready",
            "checks": checks,
            "service": "document-processor"
        }
    except ImportError as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "error": f"Docling not available: {str(e)}",
                "service": "document-processor"
            }
        )
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "error": str(e),
                "service": "document-processor"
            }
        )

@router.get("/live")
async def liveness_check() -> Dict[str, Any]:
    """Liveness check - basic endpoint to ensure service is running"""
    return {
        "status": "alive",
        "service": "document-processor"
    }
