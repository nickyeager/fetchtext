import { supabase } from '@/lib/supabase'
import { withAuthentication } from '@/lib/supabase-auth-utils'
import type { UserPreferences, UserPreferencesUpdate } from '@/types/settings'

class SettingsService {
  async getUserPreferences(): Promise<UserPreferences | null> {
    return withAuthentication(async (user) => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return data
    })
  }

  async updateUserPreferences(updates: UserPreferencesUpdate): Promise<UserPreferences> {
    return withAuthentication(async (user) => {
      const { data, error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          ...updates,
        }, {
          onConflict: 'user_id',
        })
        .select()
        .single()

      if (error) throw error
      return data
    })
  }

  async initializePreferences(): Promise<UserPreferences> {
    return withAuthentication(async (user) => {
      const existing = await this.getUserPreferences()
      if (existing) return existing

      const { data, error } = await supabase
        .from('user_preferences')
        .insert({
          user_id: user.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    })
  }
}

export const settingsService = new SettingsService()
