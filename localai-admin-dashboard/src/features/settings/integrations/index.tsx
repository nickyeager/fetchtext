import ContentSection from '../components/content-section'
import { GoogleDriveSettings } from './google-drive-settings'
import { SnowflakeSettings } from './snowflake-settings'

export default function Integrations() {
  return (
    <ContentSection
      title='Integrations'
      desc='Configure third-party service integrations and API credentials.'
    >
      <div className="space-y-6">
        <GoogleDriveSettings />
        <SnowflakeSettings />
      </div>
    </ContentSection>
  )
}