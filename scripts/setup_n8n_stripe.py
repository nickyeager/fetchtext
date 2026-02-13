#!/usr/bin/env python3
"""
N8N Stripe Integration Setup Script

This script programmatically:
1. Creates required credentials (Stripe, Supabase, SendGrid)
2. Imports the Stripe subscription handler workflow
3. Activates the workflow

Prerequisites:
- N8N instance running
- N8N API key created (Settings > n8n API)
- Environment variables set in .env file

Usage:
    python scripts/setup_n8n_stripe.py
"""

import json
import os
import sys
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
N8N_BASE_URL = os.getenv("N8N_BASE_URL", "http://localhost:5678")
N8N_API_KEY = os.getenv("N8N_API_KEY", "")

# Stripe credentials from .env
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

# Supabase credentials from .env
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://rawhmcrtzfdhryyfovee.supabase.co")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SERVICE_ROLE_KEY", "")

# SendGrid credentials from .env
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")

# Workflow file paths
WORKFLOWS_DIR = Path(__file__).parent.parent / "n8n" / "backup" / "workflows"
STRIPE_WORKFLOW_FILE = WORKFLOWS_DIR / "Stripe_Subscription_Handler.json"
PROVISIONING_WORKFLOW_FILE = WORKFLOWS_DIR / "Enterprise_Subscription_Provisioning.json"


def check_prerequisites():
    """Verify all required environment variables are set."""
    missing = []

    if not N8N_API_KEY:
        missing.append("N8N_API_KEY")
    if not STRIPE_SECRET_KEY:
        missing.append("STRIPE_SECRET_KEY")
    if not STRIPE_WEBHOOK_SECRET:
        missing.append("STRIPE_WEBHOOK_SECRET")
    if not SUPABASE_SERVICE_ROLE_KEY:
        missing.append("SERVICE_ROLE_KEY")
    if not SENDGRID_API_KEY:
        missing.append("SENDGRID_API_KEY")

    if missing:
        print("❌ Missing required environment variables:")
        for var in missing:
            print(f"   - {var}")
        print("\nPlease set these in your .env file and try again.")
        print("\nTo get N8N_API_KEY:")
        print("  1. Go to N8N (http://localhost:5678)")
        print("  2. Settings > n8n API")
        print("  3. Create an API key")
        return False

    return True


def get_headers():
    """Get headers for N8N API requests."""
    return {
        "X-N8N-API-KEY": N8N_API_KEY,
        "Content-Type": "application/json"
    }


def create_credential(name: str, credential_type: str, data: dict) -> dict | None:
    """Create a credential in N8N using the internal REST API."""
    url = f"{N8N_BASE_URL}/rest/credentials"

    # Map credential types to their node types
    node_type_map = {
        "stripeApi": "n8n-nodes-base.stripeTrigger",
        "supabaseApi": "n8n-nodes-base.supabase",
        "sendGridApi": "n8n-nodes-base.sendGrid"
    }

    payload = {
        "name": name,
        "type": credential_type,
        "data": data,
        "nodesAccess": [
            {"nodeType": node_type_map.get(credential_type, credential_type)}
        ]
    }

    try:
        response = requests.post(url, json=payload, headers=get_headers())

        if response.status_code == 200:
            result = response.json()
            print(f"✅ Created credential: {name} (ID: {result.get('data', {}).get('id')})")
            return result.get("data")
        else:
            print(f"❌ Failed to create credential {name}: {response.status_code}")
            print(f"   Response: {response.text}")
            return None

    except Exception as e:
        print(f"❌ Error creating credential {name}: {e}")
        return None


def check_existing_credentials():
    """Check for existing credentials and return their IDs."""
    url = f"{N8N_BASE_URL}/rest/credentials"

    try:
        response = requests.get(url, headers=get_headers())
        if response.status_code == 200:
            return response.json().get("data", [])
        return []
    except Exception as e:
        print(f"⚠️ Could not fetch existing credentials: {e}")
        return []


def find_credential_by_type(credentials: list, cred_type: str) -> dict | None:
    """Find a credential by type in the list."""
    for cred in credentials:
        if cred.get("type") == cred_type:
            return cred
    return None


def setup_credentials():
    """Print instructions for manual credential creation (API doesn't support this)."""
    print("\n📦 N8N Credentials Setup")
    print("=" * 50)
    print("\n⚠️  Credentials must be created manually in N8N UI")
    print("   (The public API doesn't support credential creation)\n")

    print("Open N8N and create these 3 credentials:")
    print(f"   URL: {N8N_BASE_URL}/home/credentials\n")

    print("1️⃣  STRIPE CREDENTIAL")
    print("   • Click 'Add Credential' → Search 'Stripe'")
    print("   • Name: Stripe Live")
    print(f"   • Secret Key: {STRIPE_SECRET_KEY[:20]}...{STRIPE_SECRET_KEY[-10:]}")
    print()

    print("2️⃣  SUPABASE CREDENTIAL")
    print("   • Click 'Add Credential' → Search 'Supabase'")
    print("   • Name: Supabase Production")
    print(f"   • Host: {SUPABASE_URL}")
    print(f"   • Service Role Key: {SUPABASE_SERVICE_ROLE_KEY[:20]}...{SUPABASE_SERVICE_ROLE_KEY[-10:] if len(SUPABASE_SERVICE_ROLE_KEY) > 30 else '(check .env)'}")
    print()

    print("3️⃣  SENDGRID CREDENTIAL")
    print("   • Click 'Add Credential' → Search 'SendGrid'")
    print("   • Name: SendGrid")
    print(f"   • API Key: {SENDGRID_API_KEY[:15]}...{SENDGRID_API_KEY[-10:]}")
    print()

    input("Press ENTER after creating all 3 credentials to continue...")

    # Return placeholder - workflows will need manual credential assignment
    return {"stripe": True, "supabase": True, "sendgrid": True}


def update_workflow_credentials(workflow: dict, credentials: dict) -> dict:
    """Update workflow nodes with the correct credential IDs."""

    for node in workflow.get("nodes", []):
        node_credentials = node.get("credentials", {})

        # Update Stripe credentials
        if "stripeApi" in node_credentials and credentials.get("stripe"):
            node["credentials"]["stripeApi"] = {
                "id": str(credentials["stripe"]["id"]),
                "name": credentials["stripe"]["name"]
            }

        # Update Supabase credentials
        if "supabaseApi" in node_credentials and credentials.get("supabase"):
            node["credentials"]["supabaseApi"] = {
                "id": str(credentials["supabase"]["id"]),
                "name": credentials["supabase"]["name"]
            }

        # Update SendGrid credentials
        if "sendGridApi" in node_credentials and credentials.get("sendgrid"):
            node["credentials"]["sendGridApi"] = {
                "id": str(credentials["sendgrid"]["id"]),
                "name": credentials["sendgrid"]["name"]
            }

    return workflow


def import_workflow(workflow_path: Path, credentials: dict = None) -> dict | None:
    """Import a workflow into N8N."""
    url = f"{N8N_BASE_URL}/api/v1/workflows"

    if not workflow_path.exists():
        print(f"❌ Workflow file not found: {workflow_path}")
        return None

    with open(workflow_path) as f:
        workflow = json.load(f)

    # Remove credential references - user will assign manually
    for node in workflow.get("nodes", []):
        if "credentials" in node:
            del node["credentials"]

    # Remove fields that shouldn't be in the import
    workflow.pop("id", None)
    workflow.pop("versionId", None)

    try:
        response = requests.post(url, json=workflow, headers=get_headers())

        if response.status_code in [200, 201]:
            result = response.json()
            workflow_id = result.get("id")
            print(f"✅ Imported workflow: {workflow['name']} (ID: {workflow_id})")
            return result
        else:
            print(f"❌ Failed to import workflow: {response.status_code}")
            print(f"   Response: {response.text}")
            return None

    except Exception as e:
        print(f"❌ Error importing workflow: {e}")
        return None


def activate_workflow(workflow_id: str) -> bool:
    """Activate a workflow."""
    url = f"{N8N_BASE_URL}/api/v1/workflows/{workflow_id}/activate"

    try:
        response = requests.post(url, headers=get_headers())

        if response.status_code == 200:
            print(f"✅ Activated workflow ID: {workflow_id}")
            return True
        else:
            print(f"❌ Failed to activate workflow: {response.status_code}")
            return False

    except Exception as e:
        print(f"❌ Error activating workflow: {e}")
        return False


def get_webhook_url(workflow_id: str) -> str | None:
    """Get the webhook URL for an activated workflow."""
    url = f"{N8N_BASE_URL}/api/v1/workflows/{workflow_id}"

    try:
        response = requests.get(url, headers=get_headers())

        if response.status_code == 200:
            workflow = response.json()

            # Find the webhook/trigger node
            for node in workflow.get("nodes", []):
                if "Trigger" in node.get("type", ""):
                    # The webhook URL is constructed from the workflow ID
                    webhook_path = f"/webhook/{workflow_id}"
                    return f"{N8N_BASE_URL}{webhook_path}"

        return None

    except Exception as e:
        print(f"⚠️ Could not get webhook URL: {e}")
        return None


def main():
    print("=" * 60)
    print("  N8N Stripe Integration Setup")
    print("=" * 60)

    # Check prerequisites
    if not check_prerequisites():
        sys.exit(1)

    # Test N8N connection
    print("\n🔗 Testing N8N connection...")
    try:
        response = requests.get(f"{N8N_BASE_URL}/api/v1/workflows", headers=get_headers())
        if response.status_code != 200:
            print(f"❌ Could not connect to N8N: {response.status_code}")
            print("   Make sure N8N is running and your API key is correct.")
            sys.exit(1)
        print("✅ Connected to N8N")
    except Exception as e:
        print(f"❌ Could not connect to N8N: {e}")
        sys.exit(1)

    # Setup credentials
    credentials = setup_credentials()

    # Credentials are created manually, continue with workflow import

    # Import workflows
    print("\n📥 Importing workflows...")

    stripe_workflow = import_workflow(STRIPE_WORKFLOW_FILE, credentials)
    if stripe_workflow:
        activate_workflow(stripe_workflow["id"])

    provisioning_workflow = import_workflow(PROVISIONING_WORKFLOW_FILE, credentials)
    if provisioning_workflow:
        activate_workflow(provisioning_workflow["id"])

    # Summary
    print("\n" + "=" * 60)
    print("  Workflows Imported!")
    print("=" * 60)

    print("\n📋 IMPORTANT - Assign Credentials to Workflows:")
    print(f"   1. Open: {N8N_BASE_URL}/home/workflows")
    print("   2. Click on 'Stripe Subscription Handler'")
    print("   3. Click each node with a ⚠️ warning and assign the credential:")
    print("      • Stripe Trigger → Select 'Stripe Live'")
    print("      • Supabase nodes → Select 'Supabase Production'")
    print("      • SendGrid node → Select 'SendGrid'")
    print("   4. Save and Activate the workflow")
    print("   5. Repeat for 'Enterprise Subscription Provisioning' if imported")

    print("\n📋 Final Steps:")
    print("   1. Copy the webhook URL from the Stripe Trigger node")
    print("   2. Verify it matches what's in Stripe Dashboard")
    print("   3. Test with a Stripe test payment")


if __name__ == "__main__":
    main()
