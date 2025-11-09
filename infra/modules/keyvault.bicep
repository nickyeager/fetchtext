param name string
param location string
param tenantId string
param accessPolicies array
param tags object = {}

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  properties: {
    tenantId: tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enabledForDeployment: false
    enabledForTemplateDeployment: false
    enabledForDiskEncryption: false
    softDeleteRetentionInDays: 7
    accessPolicies: accessPolicies
  }
  tags: tags
}

output id string = vault.id
output vaultUri string = vault.properties.vaultUri
