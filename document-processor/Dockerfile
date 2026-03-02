FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required for document processing
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    poppler-utils \
    tesseract-ocr \
    libreoffice \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=1000 -r requirements.txt

# Pre-download RapidOCR models so they're baked into the image layer.
# Without this, the first Docling request downloads ~40MB from modelscope.cn,
# adding 60-90s to the first document processing call.
RUN python -c "\
from rapidocr import RapidOCR; \
from rapidocr.utils.parse_parameters import EngineType; \
RapidOCR(params={ \
  'Det.engine_type': EngineType.TORCH, \
  'Cls.engine_type': EngineType.TORCH, \
  'Rec.engine_type': EngineType.TORCH, \
}); \
print('RapidOCR torch models cached')" \
    || echo "WARN: RapidOCR model pre-download skipped (non-fatal)"

# Pre-download Docling ML models (layout analysis + table structure, ~506MB).
# Without this, the first PDF conversion stalls for 2+ minutes downloading
# from HuggingFace, often exceeding the SSE stream timeout.
RUN docling-tools models download layout tableformer --quiet \
    && echo "Docling layout + tableformer models cached" \
    || echo "WARN: Docling model pre-download skipped (non-fatal)"

# Copy application code
COPY . .

# Create directories for file processing
RUN mkdir -p /app/uploads /app/processed /app/temp

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8090/health || exit 1

# Expose port
EXPOSE 8090

# NOTE: Removed '--reload' for production stability. The reload watcher can hang under heavy filesystem volumes,
# causing the health endpoint to stop responding while the process appears alive. Use a dev override if needed.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090", "--proxy-headers", "--forwarded-allow-ips", "*"]
