param name string
param location string
param logAnalyticsId string
param logAnalyticsCustomerId string
@secure()
param logAnalyticsSharedKey string
param tags object = {}

resource managedEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: name
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsCustomerId
        sharedKey: logAnalyticsSharedKey
      }
    }
  }
  tags: tags
}

output id string = managedEnv.id
