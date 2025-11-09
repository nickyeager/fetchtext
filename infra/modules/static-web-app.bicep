param name string
@allowed([
  'Free'
  'Standard'
])
param sku string = 'Standard'
param location string = 'Central US'
param tags object = {}
param customDomains array = []

resource staticApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: name
  location: location
  sku: {
    name: sku
    tier: sku
  }
  properties: {
    allowConfigFileUpdates: false
  }
  tags: tags
}

// Optionally assign custom domains (manual DNS validation still required).
@batchSize(1)
resource customDomainResources 'Microsoft.Web/staticSites/customDomains@2023-01-01' = [for domainName in customDomains: {
  name: '${name}/${domainName}'
  properties: {
    domainName: domainName
  }
  dependsOn: [
    staticApp
  ]
}]

output id string = staticApp.id
output hostname string = staticApp.properties.defaultHostname
