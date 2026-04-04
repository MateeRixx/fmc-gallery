-- Migration: Add OAuth Support for Google Authentication
-- Created: 2026-03-28
-- Description: Adds OAuth fields to users table and creates visitor profiles tables

BEGIN;

-- 1. Add OAuth columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'ADMIN'
  CHECK (user_type IN ('ADMIN', 'VISITOR'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider TEXT
  CHECK (oauth_provider IN ('google', 'email', NULL));

ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_id TEXT;

-- Create unique index for oauth_id (only when not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth_id
  ON users(oauth_id) WHERE oauth_id IS NOT NULL;

-- 2. Create visitor_profiles table
CREATE TABLE IF NOT EXISTS visitor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  profile_photo_url TEXT,
  aws_face_id TEXT,
  profile_embedding VECTOR(512),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_visitor_user UNIQUE(user_id),
  CONSTRAINT unique_visitor_email UNIQUE(email),
  CONSTRAINT unique_aws_face_id UNIQUE(aws_face_id)
);

-- Create indexes for visitor_profiles
CREATE INDEX IF NOT EXISTS idx_visitor_profiles_user_id
  ON visitor_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_visitor_profiles_email
  ON visitor_profiles(email);

CREATE INDEX IF NOT EXISTS idx_visitor_profiles_aws_face_id
  ON visitor_profiles(aws_face_id) WHERE aws_face_id IS NOT NULL;

-- 3. Create user_photo_matches table
CREATE TABLE IF NOT EXISTS user_photo_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_profile_id UUID NOT NULL REFERENCES visitor_profiles(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  similarity_score FLOAT NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
  face_bounding_box JSONB,
  matched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_user_photo_match UNIQUE(visitor_profile_id, photo_id)
);

-- Create indexes for user_photo_matches
CREATE INDEX IF NOT EXISTS idx_user_photo_matches_visitor
  ON user_photo_matches(visitor_profile_id);

CREATE INDEX IF NOT EXISTS idx_user_photo_matches_photo
  ON user_photo_matches(photo_id);

CREATE INDEX IF NOT EXISTS idx_user_photo_matches_similarity
  ON user_photo_matches(similarity_score DESC);

-- 4. Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 5. Set up RLS policies for visitor_profiles
ALTER TABLE visitor_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON visitor_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON visitor_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON visitor_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON visitor_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('HEAD', 'CO_HEAD', 'EXECUTIVE')
    )
  );

-- 6. Set up RLS policies for user_photo_matches
ALTER TABLE user_photo_matches ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own matches
CREATE POLICY "Users can read own matches"
  ON user_photo_matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM visitor_profiles
      WHERE visitor_profiles.id = user_photo_matches.visitor_profile_id
      AND visitor_profiles.user_id = auth.uid()
    )
  );

-- Policy: System can insert matches (via service role)
CREATE POLICY "Service role can insert matches"
  ON user_photo_matches FOR INSERT
  WITH CHECK (true);

-- Policy: Users can delete their own matches
CREATE POLICY "Users can delete own matches"
  ON user_photo_matches FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM visitor_profiles
      WHERE visitor_profiles.id = user_photo_matches.visitor_profile_id
      AND visitor_profiles.user_id = auth.uid()
    )
  );

-- 7. Create function to update visitor_profiles.updated_at
CREATE OR REPLACE FUNCTION update_visitor_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_visitor_profile_timestamp ON visitor_profiles;
CREATE TRIGGER trigger_update_visitor_profile_timestamp
  BEFORE UPDATE ON visitor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_visitor_profile_timestamp();

-- 8. Add comments for documentation
COMMENT ON TABLE visitor_profiles IS 'Stores profile information for visitor users who sign in with OAuth';
COMMENT ON TABLE user_photo_matches IS 'Stores matches between visitor profiles and photos containing their face';
COMMENT ON COLUMN users.user_type IS 'User type: ADMIN (staff) or VISITOR (public user)';
COMMENT ON COLUMN users.oauth_provider IS 'OAuth provider used for authentication (google, email, or NULL for legacy)';
COMMENT ON COLUMN users.oauth_id IS 'Unique identifier from OAuth provider';

COMMIT;

-- Verification queries (run separately to check migration success)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('user_type', 'oauth_provider', 'oauth_id');
-- SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'visitor_profiles');
-- SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_photo_matches');
