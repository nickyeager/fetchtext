# GitHub Secrets Setup Guide

This document contains the required GitHub secrets for deploying the FetchText platform.

## Quick Setup

Run these commands to set all required GitHub secrets:

```bash
# Supabase Configuration (Managed project)
gh secret set VITE_SUPABASE_URL --body 'https://<project-ref>.supabase.co'
gh secret set VITE_SUPABASE_ANON_KEY --body '<anon-key-from-managed-project>'

# Azure Authentication
gh secret set AZURE_CLIENT_ID --body '8137d884-7105-4f60-a229-abf6ddb5f818'
gh secret set AZURE_TENANT_ID --body 'ccb37c3a-9343-439f-b6cf-640d8a76b5f5'
gh secret set AZURE_SUBSCRIPTION_ID --body '9b59b2e8-2e75-459b-8632-b531c3bf5470'

# Azure Resources
gh secret set AZURE_CONTAINERAPPS_RESOURCE_GROUP --body 'nickcyeager-rg'
gh secret set AZURE_CONTAINERAPP_NAME --body 'ft-dev-document-processor-uhqrm5'
gh secret set AZURE_ACR_NAME --body 'ftdevuhqrm5acr'
```

## Secrets Reference

| Secret Name | Value | Purpose |
|-------------|-------|---------|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Managed Supabase base URL (store actual value in Key Vault) |
| `VITE_SUPABASE_ANON_KEY` | `<anon-key>` | Managed Supabase anon key (fetch from Key Vault) |
| `AZURE_CLIENT_ID` | `8137d884-7105-4f60-a229-abf6ddb5f818` | Service Principal Application ID |
| `AZURE_TENANT_ID` | `ccb37c3a-9343-439f-b6cf-640d8a76b5f5` | Azure Active Directory Tenant ID |
| `AZURE_SUBSCRIPTION_ID` | `9b59b2e8-2e75-459b-8632-b531c3bf5470` | Azure Subscription ID |
| `AZURE_CONTAINERAPPS_RESOURCE_GROUP` | `nickcyeager-rg` | Resource Group for Container Apps |
| `AZURE_CONTAINERAPP_NAME` | `ft-dev-document-processor-uhqrm5` | Document Processor Container App name |
| `AZURE_ACR_NAME` | `ftdevuhqrm5acr` | Azure Container Registry name |

## Deployment Endpoints

### Production URLs
- **Admin Dashboard**: https://kind-island-00cd78710.3.azurestaticapps.net
- **Document Processor**: https://ft-dev-document-processor-uhqrm5.graystone-50b6fbc2.eastus2.azurecontainerapps.io
- **Supabase API**: Managed endpoint stored in Key Vault (`supabase-url`)

### GitHub Workflows
- **Dashboard Deployment**: `.github/workflows/deploy-dashboard.yml`
- **Container App Deployment**: `.github/workflows/deploy-container-app.yml`

## Verification

After setting secrets, verify they're configured:

```bash
# List all secrets (values hidden)
gh secret list
```

## Troubleshooting

### Authentication Errors
If you see "Login failed with Error: Using auth-type: SERVICE_PRINCIPAL":
- Verify `AZURE_CLIENT_ID` is set correctly
- Verify `AZURE_TENANT_ID` is set correctly
- Check that the Service Principal has proper permissions

### Deployment Errors
- Ensure resource names match exactly (case-sensitive)
- Verify the Service Principal has Contributor role on the subscription
- Check that federated credentials are configured for GitHub Actions

## Security Notes

- All secrets are stored encrypted in GitHub
- Never commit these values to source control
- Rotate credentials regularly following security best practices
- Store Supabase secrets in Azure Key Vault and rotate them there before updating GitHub secrets

## Related Documentation

- [Setup Guide](./setup.md) - Production deployment endpoints
- [Supabase Documentation](./supabase.md) - Managed + local Supabase overview
