# Azure Credentials Setup for GitHub Actions

## Problem Solved

The workflow was using OIDC authentication which requires federated credentials in Azure AD. We've switched to **client secret authentication** which is simpler and doesn't require federated credential setup.

## Create Azure Service Principal with Client Secret

You need to create an `AZURE_CREDENTIALS` secret containing the service principal JSON.

### Option 1: Using Azure CLI (Recommended)

```bash
# Create service principal with contributor role
az ad sp create-for-rbac \
  --name "fetchtext-github-actions" \
  --role contributor \
  --scopes /subscriptions/9b59b2e8-2e75-459b-8632-b531c3bf5470 \
  --sdk-auth
```

This command will output JSON like:

```json
{
  "clientId": "8137d884-7105-4f60-a229-abf6ddb5f818",
  "clientSecret": "YOUR-CLIENT-SECRET-HERE",
  "subscriptionId": "9b59b2e8-2e75-459b-8632-b531c3bf5470",
  "tenantId": "ccb37c3a-9343-439f-b6cf-640d8a76b5f5",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

### Option 2: Using Existing Service Principal

If the service principal already exists (which it likely does since you have a client ID), you need to:

1. **Get/Create a Client Secret** via Azure Portal:
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to: **Azure Active Directory** → **App registrations**
   - Find app with Client ID: `8137d884-7105-4f60-a229-abf6ddb5f818`
   - Click **Certificates & secrets** → **Client secrets** → **New client secret**
   - Add description: "GitHub Actions"
   - Set expiration (recommend: 24 months)
   - Copy the secret value (you won't see it again!)

2. **Create the JSON manually**:

```json
{
  "clientId": "8137d884-7105-4f60-a229-abf6ddb5f818",
  "clientSecret": "PASTE-YOUR-NEW-CLIENT-SECRET-HERE",
  "subscriptionId": "9b59b2e8-2e75-459b-8632-b531c3bf5470",
  "tenantId": "ccb37c3a-9343-439f-b6cf-640d8a76b5f5",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

## Add GitHub Secret

### Via GitHub CLI

```bash
# Save the JSON to a file first
cat > /tmp/azure-creds.json << 'EOF'
{
  "clientId": "8137d884-7105-4f60-a229-abf6ddb5f818",
  "clientSecret": "YOUR-CLIENT-SECRET",
  "subscriptionId": "9b59b2e8-2e75-459b-8632-b531c3bf5470",
  "tenantId": "ccb37c3a-9343-439f-b6cf-640d8a76b5f5",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
EOF

# Set the secret
gh secret set AZURE_CREDENTIALS < /tmp/azure-creds.json

# Clean up
rm /tmp/azure-creds.json
```

### Via GitHub Web UI

1. Go to: `https://github.com/YOUR-USERNAME/local-ai-packaged/settings/secrets/actions`
2. Click **"New repository secret"**
3. Name: `AZURE_CREDENTIALS`
4. Value: Paste the entire JSON (with your actual client secret)
5. Click **"Add secret"**

## Verify and Test

After adding the secret:

1. **Check the secret exists**:
   ```bash
   gh secret list | grep AZURE_CREDENTIALS
   ```

2. **Trigger the workflow**:
   - Go to **Actions** tab
   - Click **"Deploy Document Processor (Container App)"**
   - Click **"Run workflow"**
   - Select `main` branch
   - Click **"Run workflow"**

3. **Monitor the Azure Login step** - it should now succeed!

## Troubleshooting

### Error: "Login failed"
- Verify the client secret is correct (no extra spaces/newlines)
- Ensure the service principal has Contributor role on the subscription
- Check the JSON format is valid

### Error: "Insufficient privileges"
- The service principal needs Contributor role
- Run: `az role assignment create --assignee 8137d884-7105-4f60-a229-abf6ddb5f818 --role Contributor --scope /subscriptions/9b59b2e8-2e75-459b-8632-b531c3bf5470`

## Security Notes

- **Never commit the client secret to source control**
- The secret expires based on what you set (default 24 months)
- Rotate secrets regularly for security
- Store backup of the JSON in a secure password manager

## What Changed

The workflow file was updated from OIDC authentication to client secret authentication:

**Before** (OIDC - requires federated credentials):
```yaml
permissions:
  id-token: write
  contents: read

- name: Azure Login
  uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

**After** (Client Secret - simpler, works immediately):
```yaml
- name: Azure Login
  uses: azure/login@v2
  with:
    creds: ${{ secrets.AZURE_CREDENTIALS }}
```

The old individual secrets (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`) are still set but no longer used by this workflow.
