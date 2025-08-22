import { ContentSection } from '../components/content-section'
import { GoogleDriveSettings } from './google-drive-settings'

export default function Integrations() {
  return (
    <ContentSection
      title='Integrations'
      desc='Configure third-party service integrations and API credentials.'
    >
      <GoogleDriveSettings />
    </ContentSection>
  )
}