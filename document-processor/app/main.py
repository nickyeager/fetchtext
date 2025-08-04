from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import os
from pathlib import Path

# Import routers
from app.routers import documents, health, enhanced_documents, models

app = FastAPI(
    title="Document Processor API",
    description="Advanced document processing service using Docling",
    version="1.0.0"
)

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

@app.get("/")
async def root():
    return {
        "message": "Document Processor API",
        "version": "1.0.0",
        "status": "running"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8090)
