#!/bin/bash
docker cp ../document-processor/app/routers/enhanced_documents.py localai-document-processor:/app/app/routers/enhanced_documents.py
docker restart localai-document-processor
sleep 10
curl -s http://localhost:8090/health
