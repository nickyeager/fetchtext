-- User preferences table for settings persistence
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Profile settings
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,

  -- Account settings
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  date_of_birth DATE,

  -- Appearance settings (sync from localStorage)
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  font TEXT DEFAULT 'geist',

  -- Notification preferences
  notification_type TEXT DEFAULT 'all' CHECK (notification_type IN ('all', 'mentions', 'none')),
  email_communication BOOLEAN DEFAULT FALSE,
  email_marketing BOOLEAN DEFAULT FALSE,
  email_social BOOLEAN DEFAULT FALSE,
  email_security BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT user_preferences_user_id_key UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own preferences
CREATE POLICY "Users can view own preferences" ON user_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences" ON user_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();

-- Create index for fast lookups
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
