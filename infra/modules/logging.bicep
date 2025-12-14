param name string
param location string
param tags object = {}

resource workspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: name
  location: location
  properties: {
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
  tags: tags
}

output id string = workspace.id
output customerId string = workspace.properties.customerId
output sharedKey string = listKeys(workspace.id, '2015-11-01-preview').primarySharedKey
