-- Create Admin User for FetchText
-- Run this in Supabase SQL Editor AFTER running SUPABASE_MIGRATION.sql
-- https://app.supabase.com/project/rawhmcrtzfdhryyfovee/sql/new

-- Admin credentials:
-- Email: admin@fetchtext.local
-- Password: AdminPass2024!

-- Note: If user already exists, delete it first or use a different email
-- DELETE FROM auth.users WHERE email = 'admin@fetchtext.local';

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin@fetchtext.local',
  crypt('AdminPass2024!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin User"}',
  false,
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  ''
);

-- Verify user was created
SELECT id, email, created_at, email_confirmed_at
FROM auth.users
WHERE email = 'admin@fetchtext.local';
