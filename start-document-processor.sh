#!/bin/bash

# Start Document Processor Service Script
echo "Starting Document Processor Service..."

# Navigate to the main directory
cd /Users/nickyeager/Code/agents/local-ai-packaged

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Docker is not running. Please start Docker first."
    exit 1
fi

# Build the document processor if needed
echo "Building document processor..."
docker compose build document-processor

# Start the service
echo "Starting document processor service..."
docker compose up -d document-processor

# Wait a moment for the service to start
sleep 5

# Check if the service is running
if docker compose ps document-processor | grep -q "Up"; then
    echo "✅ Document processor service is running!"
    echo "📝 Service available at: http://localhost:8090"
    echo "🔍 Health check: http://localhost:8090/health"
    
    # Test the health endpoint
    echo "Testing health endpoint..."
    if curl -f http://localhost:8090/health 2>/dev/null; then
        echo "✅ Health check passed!"
    else
        echo "⚠️ Health check failed - service may still be starting up"
    fi
else
    echo "❌ Failed to start document processor service"
    echo "Checking logs..."
    docker compose logs document-processor
fi
