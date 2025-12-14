# Final Steps: Add AZURE_CREDENTIALS Secret

## ✅ Completed
- ✅ Workflow updated to use client secret authentication
- ✅ Changes pushed to GitHub without secrets
- ✅ `azure-credentials.json` added to `.gitignore`
- ✅ Stale files cleaned up (46 files removed)
- ✅ Documentation updated

## 🔐 Remaining: Add AZURE_CREDENTIALS to GitHub

### The JSON You Need to Add

```json
{
  "clientId": "8137d884-7105-4f60-a229-abf6ddb5f818",
  "clientSecret": "joW8Q~JfxEUS0tK4avdsQl4PN-eY9KNFhHoKOaPZ",
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

### Steps to Add the Secret

1. **Go to GitHub Repository Secrets**:
   - Navigate to: `https://github.com/nickyeager/fetchtext/settings/secrets/actions`

2. **Create New Secret**:
   - Click **"New repository secret"**
   - Name: `AZURE_CREDENTIALS`
   - Value: Copy and paste the entire JSON above
   - Click **"Add secret"**

3. **Verify**:
   - The secret should appear in your secrets list
   - You won't be able to see the value again (GitHub security)

### Test the Deployment

After adding the secret:

1. **Go to Actions Tab**:
   - `https://github.com/nickyeager/fetchtext/actions`

2. **Run the Workflow**:
   - Click **"Deploy Document Processor (Container App)"**
   - Click **"Run workflow"** dropdown
   - Select branch: `feature/document-generation-ui` or `main`
   - Click **"Run workflow"** button

3. **Monitor the Azure Login Step**:
   - Watch the workflow execution
   - The "Azure Login" step should now succeed ✅
   - The workflow will then build and deploy your container app

## All GitHub Secrets Summary

After adding `AZURE_CREDENTIALS`, you'll have these secrets configured:

| Secret Name | Purpose | Status |
|-------------|---------|--------|
| `AZURE_CREDENTIALS` | Azure authentication (JSON) | ⏳ **Need to add** |
| `AZURE_CLIENT_ID` | Service Principal ID | ✅ Set (no longer used) |
| `AZURE_TENANT_ID` | Azure AD Tenant | ✅ Set (no longer used) |
| `AZURE_SUBSCRIPTION_ID` | Subscription ID | ✅ Set (no longer used) |
| `AZURE_CONTAINERAPPS_RESOURCE_GROUP` | Resource Group | ✅ Set |
| `AZURE_CONTAINERAPP_NAME` | Container App Name | ✅ Set |
| `AZURE_ACR_NAME` | Container Registry | ✅ Set |
| `VITE_SUPABASE_URL` | Managed Supabase URL | ✅ Set |
| `VITE_SUPABASE_ANON_KEY` | Managed Supabase anon key | ✅ Set |

## Security Notes

- ⚠️ **Never commit the client secret to git**
- ⚠️ The secret expires (check expiration in Azure Portal)
- ⚠️ Rotate secrets regularly for security
- ✅ `azure-credentials.json` is now in `.gitignore`

## Troubleshooting

### If the workflow still fails:
1. Double-check the JSON format is exactly as shown above
2. Ensure no extra spaces or newlines in the secret value
3. Verify the service principal has Contributor role on the subscription
4. Check the workflow logs for specific error messages

### To rotate the client secret:
1. Create a new secret in Azure Portal (App registrations → Certificates & secrets)
2. Update the `AZURE_CREDENTIALS` secret in GitHub with the new JSON
3. Delete the old secret from Azure Portal after verifying the new one works

## Documentation References

- [GitHub Secrets Setup Guide](./documentation/github-secrets-setup.md)
- [Azure Credentials Setup](./documentation/azure-credentials-setup.md)
- [Setup Documentation](./documentation/setup.md)

---

**Delete this file after you've added the AZURE_CREDENTIALS secret!**
