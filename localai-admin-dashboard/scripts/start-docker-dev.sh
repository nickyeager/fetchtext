#!/bin/bash
# Start the admin dashboard in Docker dev mode with hot reload

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Starting LocalAI Admin Dashboard in Docker Dev Mode"
echo "   With hot reload enabled on port 5174"
echo ""

cd "$PROJECT_ROOT"

# Load environment variables from root .env
if [ -f "../.env" ]; then
    set -a
    source <(grep -v '^#' ../.env | grep -v '^$' | sed 's/#.*$//' | sed 's/[[:space:]]*$//')
    set +a
fi

# Start the dev container
docker compose -f docker-compose.dev.yml up --build

echo ""
echo "✅ Dashboard running at: http://localhost:5174"
echo "   Files in src/ are hot-reloaded automatically"
echo "   Use 'Chrome: Docker Dev' launch config in VSCode for debugging"
