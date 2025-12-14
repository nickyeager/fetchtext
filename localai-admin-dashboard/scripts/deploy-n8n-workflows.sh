#!/bin/bash

# Deploy N8N Workflows for FetchText Email System
# This script imports and activates N8N workflows for email functionality

set -e

echo "🚀 FetchText N8N Workflow Deployment"
echo "======================================"

# Configuration
N8N_URL="${N8N_URL:-http://localhost:5678}"
N8N_API_KEY="${N8N_API_KEY:-}"
WORKFLOW_DIR="../n8n/backup/workflows"

# Check if N8N is running
echo "📋 Checking N8N availability..."
if ! curl -s "$N8N_URL/healthz" > /dev/null 2>&1; then
    echo "❌ N8N is not running at $N8N_URL"
    echo "Please start N8N first:"
    echo "  cd ../"
    echo "  docker-compose up -d n8n"
    exit 1
fi

echo "✅ N8N is running at $N8N_URL"

# Function to import workflow
import_workflow() {
    local workflow_file="$1"
    local workflow_name="$2"
    
    echo "📥 Importing workflow: $workflow_name"
    
    # Check if workflow already exists
    if [[ -n "$N8N_API_KEY" ]]; then
        EXISTING_WORKFLOW=$(curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows" | jq -r ".[] | select(.name == \"$workflow_name\") | .id")
    else
        EXISTING_WORKFLOW=$(curl -s "$N8N_URL/api/v1/workflows" | jq -r ".[] | select(.name == \"$workflow_name\") | .id")
    fi
    
    if [[ -n "$EXISTING_WORKFLOW" && "$EXISTING_WORKFLOW" != "null" ]]; then
        echo "⚠️  Workflow '$workflow_name' already exists (ID: $EXISTING_WORKFLOW)"
        echo "   Activating existing workflow..."
        
        # Activate existing workflow
        if [[ -n "$N8N_API_KEY" ]]; then
            curl -s -X POST -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows/$EXISTING_WORKFLOW/activate"
        else
            curl -s -X POST "$N8N_URL/api/v1/workflows/$EXISTING_WORKFLOW/activate"
        fi
        
        echo "✅ Workflow '$workflow_name' activated successfully"
        return 0
    fi
    
    # Import new workflow
    if [[ -n "$N8N_API_KEY" ]]; then
        WORKFLOW_ID=$(curl -s -X POST \
            -H "Content-Type: application/json" \
            -H "X-N8N-API-KEY: $N8N_API_KEY" \
            -d @"$workflow_file" \
            "$N8N_URL/api/v1/workflows" | jq -r '.id')
    else
        WORKFLOW_ID=$(curl -s -X POST \
            -H "Content-Type: application/json" \
            -d @"$workflow_file" \
            "$N8N_URL/api/v1/workflows" | jq -r '.id')
    fi
    
    if [[ -z "$WORKFLOW_ID" || "$WORKFLOW_ID" == "null" ]]; then
        echo "❌ Failed to import workflow: $workflow_name"
        return 1
    fi
    
    echo "📦 Workflow imported with ID: $WORKFLOW_ID"
    
    # Activate the workflow
    if [[ -n "$N8N_API_KEY" ]]; then
        curl -s -X POST -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows/$WORKFLOW_ID/activate"
    else
        curl -s -X POST "$N8N_URL/api/v1/workflows/$WORKFLOW_ID/activate"
    fi
    
    echo "✅ Workflow '$workflow_name' imported and activated successfully"
}

# Import FetchText Password Reset Email workflow
echo ""
echo "📧 Deploying FetchText Email Workflows"
echo "--------------------------------------"

if [[ -f "$WORKFLOW_DIR/FetchText_Password_Reset_Email.json" ]]; then
    import_workflow "$WORKFLOW_DIR/FetchText_Password_Reset_Email.json" "FetchText Password Reset Email"
else
    echo "❌ Workflow file not found: $WORKFLOW_DIR/FetchText_Password_Reset_Email.json"
    exit 1
fi

# Setup SendGrid credentials reminder
echo ""
echo "🔑 SendGrid Configuration Required"
echo "-----------------------------------"
echo "To complete the setup, you need to configure SendGrid credentials in N8N:"
echo ""
echo "1. Open N8N UI: $N8N_URL"
echo "2. Go to Credentials > Create New Credential"
echo "3. Search for 'SendGrid'"
echo "4. Create credential with name: 'SendGrid API'"
echo "5. Enter your SendGrid API Key: ${SENDGRID_API_KEY:-<your-api-key>}"
echo "6. Save the credential"
echo ""
echo "Your SendGrid verified sender: yeag123@gmail.com"

# Test webhook endpoint
echo ""
echo "🧪 Testing Webhook Endpoints"
echo "-----------------------------"
echo "Password Reset Webhook: $N8N_URL/webhook/password-reset-email"

# Test the webhook
echo "Testing webhook connectivity..."
if curl -s -X POST -H "Content-Type: application/json" -d '{"test": true}' "$N8N_URL/webhook/password-reset-email" > /dev/null 2>&1; then
    echo "✅ Webhook is accessible"
else
    echo "⚠️  Webhook may not be active (this is normal if SendGrid credentials are not configured)"
fi

echo ""
echo "🎉 N8N Workflow Deployment Complete!"
echo "====================================="
echo ""
echo "Next steps:"
echo "1. Configure SendGrid credentials in N8N UI"
echo "2. Test the email flow from the FetchText app"
echo "3. Monitor workflow executions in N8N UI"
echo ""
echo "Frontend will automatically use N8N webhooks for email sending."
echo "Development mode will continue to use console logging." 