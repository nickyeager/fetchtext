#!/bin/bash
# =============================================================================
# Snowflake Integration Test Setup
#
# This script prepares everything needed to test the Snowflake Stages
# integration with a REAL Snowflake account.
#
# Prerequisites:
#   1. Sign up for Snowflake trial at https://signup.snowflake.com/
#   2. Have OpenSSL installed (comes with macOS)
#   3. Have the document-processor running
#
# Usage:
#   chmod +x scripts/setup_snowflake_test.sh
#   ./scripts/setup_snowflake_test.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
KEY_DIR="$PROJECT_ROOT/.snowflake-keys"

echo "=============================================="
echo "  Snowflake Integration Test Setup"
echo "=============================================="
echo ""

# =============================================================================
# Step 1: Generate RSA Key Pair
# =============================================================================
echo "--- Step 1: Generate RSA Key Pair ---"
echo ""

if [ -f "$KEY_DIR/rsa_key.p8" ]; then
    echo "Key pair already exists at $KEY_DIR/"
    echo "  Private key: $KEY_DIR/rsa_key.p8"
    echo "  Public key:  $KEY_DIR/rsa_key.pub"
    echo ""
    read -p "Regenerate keys? (y/N): " REGEN
    if [ "$REGEN" != "y" ] && [ "$REGEN" != "Y" ]; then
        echo "Keeping existing keys."
    else
        rm -f "$KEY_DIR/rsa_key.p8" "$KEY_DIR/rsa_key.pub"
    fi
fi

if [ ! -f "$KEY_DIR/rsa_key.p8" ]; then
    mkdir -p "$KEY_DIR"

    echo "Generating 2048-bit RSA key pair (unencrypted for testing)..."
    echo ""

    # Generate unencrypted private key in PKCS#8 format
    openssl genrsa 2048 2>/dev/null | \
        openssl pkcs8 -topk8 -inform PEM -out "$KEY_DIR/rsa_key.p8" -nocrypt

    # Generate corresponding public key
    openssl rsa -in "$KEY_DIR/rsa_key.p8" -pubout -out "$KEY_DIR/rsa_key.pub" 2>/dev/null

    echo "Keys generated:"
    echo "  Private key: $KEY_DIR/rsa_key.p8"
    echo "  Public key:  $KEY_DIR/rsa_key.pub"

    # Add to .gitignore if not already there
    if ! grep -q ".snowflake-keys" "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
        echo "" >> "$PROJECT_ROOT/.gitignore"
        echo "# Snowflake test keys" >> "$PROJECT_ROOT/.gitignore"
        echo ".snowflake-keys/" >> "$PROJECT_ROOT/.gitignore"
        echo "Added .snowflake-keys/ to .gitignore"
    fi
fi

echo ""

# =============================================================================
# Step 2: Display public key for Snowflake user setup
# =============================================================================
echo "--- Step 2: Configure Snowflake User ---"
echo ""
echo "Copy the PUBLIC KEY below (without the header/footer lines):"
echo ""

# Extract just the base64 content (no headers)
PUBLIC_KEY=$(grep -v "^-----" "$KEY_DIR/rsa_key.pub" | tr -d '\n')
echo "$PUBLIC_KEY"
echo ""
echo "Then run this SQL in your Snowflake console (Snowsight SQL Worksheet):"
echo ""
echo "  -- Replace YOUR_USERNAME with your Snowflake username"
echo "  ALTER USER YOUR_USERNAME SET RSA_PUBLIC_KEY='$PUBLIC_KEY';"
echo ""
echo "To verify it was set:"
echo "  DESC USER YOUR_USERNAME;"
echo "  -- Look for RSA_PUBLIC_KEY_FP (fingerprint) in the output"
echo ""

read -p "Press Enter once you've configured the public key in Snowflake..."
echo ""

# =============================================================================
# Step 3: Create test stage and upload sample files
# =============================================================================
echo "--- Step 3: Create Test Stage ---"
echo ""
echo "Run these SQL commands in your Snowflake console to create a test stage"
echo "with sample files:"
echo ""
cat << 'SNOWFLAKE_SQL'
-- Create a test database and schema (or use existing ones)
CREATE DATABASE IF NOT EXISTS FETCHTEXT_TEST;
USE DATABASE FETCHTEXT_TEST;
CREATE SCHEMA IF NOT EXISTS TEST_SCHEMA;
USE SCHEMA TEST_SCHEMA;

-- Create a named internal stage for testing
CREATE STAGE IF NOT EXISTS TEST_DOCUMENTS_STAGE
  DIRECTORY = (ENABLE = TRUE)
  COMMENT = 'FetchText integration test stage';

-- Verify the stage was created
SHOW STAGES;

-- Upload test files using SnowSQL CLI (run from your terminal, not Snowsight):
--   snowsql -a YOUR_ACCOUNT -u YOUR_USER --private-key-path /path/to/rsa_key.p8
--   PUT file:///path/to/test.pdf @FETCHTEXT_TEST.TEST_SCHEMA.TEST_DOCUMENTS_STAGE;
--   PUT file:///path/to/test.csv @FETCHTEXT_TEST.TEST_SCHEMA.TEST_DOCUMENTS_STAGE;
--
-- OR upload via Snowsight UI:
--   1. Go to Data > Databases > FETCHTEXT_TEST > TEST_SCHEMA > Stages
--   2. Click on TEST_DOCUMENTS_STAGE
--   3. Click "+ Files" button to upload test files

-- Verify files are in the stage
LIST @TEST_DOCUMENTS_STAGE;

-- Check column output format (important for our code):
-- LIST returns: name, size, md5, last_modified
-- SHOW DATABASES returns: created_on, name, is_default, is_current, origin, ...
-- SHOW SCHEMAS returns: created_on, name, is_default, is_current, ...
-- SHOW STAGES returns: created_on, name, database_name, schema_name, url, ...
SNOWFLAKE_SQL

echo ""
read -p "Press Enter once you've created the stage and uploaded test files..."
echo ""

# =============================================================================
# Step 4: Collect account details
# =============================================================================
echo "--- Step 4: Configure Environment ---"
echo ""

read -p "Snowflake account identifier (e.g., xy12345.us-east-1): " SF_ACCOUNT
read -p "Snowflake username: " SF_USER
read -p "Snowflake warehouse (e.g., COMPUTE_WH): " SF_WAREHOUSE
read -p "Test database (e.g., FETCHTEXT_TEST): " SF_DATABASE
read -p "Test schema (e.g., TEST_SCHEMA): " SF_SCHEMA
read -p "Test stage name (e.g., TEST_DOCUMENTS_STAGE): " SF_STAGE

# =============================================================================
# Step 5: Write .env.snowflake-test file
# =============================================================================
ENV_FILE="$PROJECT_ROOT/.env.snowflake-test"

cat > "$ENV_FILE" << EOF
# Snowflake Integration Test Configuration
# Generated by setup_snowflake_test.sh on $(date)
#
# Source this file before running tests:
#   source .env.snowflake-test

export SNOWFLAKE_TEST_ACCOUNT="$SF_ACCOUNT"
export SNOWFLAKE_TEST_USER="$SF_USER"
export SNOWFLAKE_TEST_PRIVATE_KEY_PATH="$KEY_DIR/rsa_key.p8"
export SNOWFLAKE_TEST_WAREHOUSE="$SF_WAREHOUSE"
export SNOWFLAKE_TEST_DATABASE="$SF_DATABASE"
export SNOWFLAKE_TEST_SCHEMA="$SF_SCHEMA"
export SNOWFLAKE_TEST_STAGE="$SF_STAGE"
EOF

echo "Environment file written to: $ENV_FILE"

# Add to .gitignore
if ! grep -q ".env.snowflake-test" "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
    echo ".env.snowflake-test" >> "$PROJECT_ROOT/.gitignore"
    echo "Added .env.snowflake-test to .gitignore"
fi

echo ""

# =============================================================================
# Step 6: Verify backend is running
# =============================================================================
echo "--- Step 5: Verify Backend ---"
echo ""

BACKEND_URL="http://localhost:8090"
if curl -s "$BACKEND_URL/health" > /dev/null 2>&1; then
    echo "Backend is running at $BACKEND_URL"
else
    echo "WARNING: Backend not available at $BACKEND_URL"
    echo "Start with: docker compose -p localai up -d --build document-processor"
    echo ""
    read -p "Press Enter once backend is running..."
fi

echo ""

# =============================================================================
# Step 7: Run tests
# =============================================================================
echo "--- Step 6: Run Integration Tests ---"
echo ""
echo "To run the backend integration tests:"
echo ""
echo "  source .env.snowflake-test"
echo "  cd document-processor"
echo "  python -m pytest tests/test_snowflake_integration.py -v"
echo ""
echo "To run the frontend integration tests:"
echo ""
echo "  cd dashboard"
echo "  source ~/.nvm/nvm.sh && nvm use 20 && npx pnpm test -- src/__tests__/integration/snowflake-integration.test.ts"
echo ""

read -p "Run backend tests now? (y/N): " RUN_TESTS
if [ "$RUN_TESTS" = "y" ] || [ "$RUN_TESTS" = "Y" ]; then
    echo "Sourcing environment..."
    source "$ENV_FILE"
    echo "Running tests..."
    cd "$PROJECT_ROOT/document-processor"
    python -m pytest tests/test_snowflake_integration.py -v
fi

echo ""
echo "=============================================="
echo "  Setup Complete!"
echo "=============================================="
echo ""
echo "Quick reference:"
echo "  Account:    $SF_ACCOUNT"
echo "  User:       $SF_USER"
echo "  Warehouse:  $SF_WAREHOUSE"
echo "  Database:   $SF_DATABASE"
echo "  Schema:     $SF_SCHEMA"
echo "  Stage:      $SF_STAGE"
echo "  Key:        $KEY_DIR/rsa_key.p8"
echo "  Env file:   $ENV_FILE"
echo ""
