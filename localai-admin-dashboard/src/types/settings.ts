export interface UserPreferences {
  id: string
  user_id: string

  // Profile
  display_name: string | null
  bio: string | null
  avatar_url: string | null

  // Account
  language: string
  timezone: string
  date_of_birth: string | null

  // Appearance
  theme: 'light' | 'dark' | 'system'
  font: string

  // Notifications
  notification_type: 'all' | 'mentions' | 'none'
  email_communication: boolean
  email_marketing: boolean
  email_social: boolean
  email_security: boolean

  created_at: string
  updated_at: string
}

export type UserPreferencesUpdate = Partial<Omit<UserPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
