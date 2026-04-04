-- ============================================================================
-- CLEAN AUTH SYSTEM SETUP
-- Run this entire script in Supabase SQL Editor
-- ============================================================================

BEGIN;

-- 1. Create verification_tokens table (for email magic links)
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires
  ON verification_tokens(expires);

-- 2. Ensure users table has required columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'ADMIN' 
  CHECK (user_type IN ('ADMIN', 'VISITOR'));

-- 3. Set up RLS for verification_tokens
ALTER TABLE verification_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage tokens" ON verification_tokens;

-- Service role can do everything with tokens
CREATE POLICY "Service role can manage tokens"
  ON verification_tokens
  FOR ALL
  USING (auth.role() = 'service_role');

-- 4. Insert your admin users (customize emails/roles as needed)
INSERT INTO users (id, email, role, user_type, full_name, permissions, is_verified, verified_at, created_at)
VALUES
  (gen_random_uuid(), '23it3028@rgipt.ac.in', 'head', 'ADMIN', '23IT3028',
   ARRAY['manage_users','manage_events','manage_photos']::TEXT[], TRUE, NOW(), '2026-01-31 07:10:16+00'),
  
  (gen_random_uuid(), '23it3043@rgipt.ac.in', 'co_head', 'ADMIN', '23IT3043',
   ARRAY['manage_events','manage_photos']::TEXT[], TRUE, NOW(), '2026-01-31 07:10:33+00'),
  
  (gen_random_uuid(), 'mohitrkumar2512@gmail.com', 'head', 'ADMIN', 'Mohit Kumar',
   ARRAY['manage_users','manage_events','manage_photos']::TEXT[], TRUE, NOW(), '2026-01-20 17:57:50+00')

ON CONFLICT (email) DO UPDATE SET
  user_type = EXCLUDED.user_type,
  is_verified = TRUE,
  verified_at = NOW();

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check verification_tokens table exists
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'verification_tokens'
ORDER BY ordinal_position;

-- Check users exist
SELECT id, email, role, user_type, is_verified, verified_at
FROM users
WHERE email IN ('23it3028@rgipt.ac.in', '23it3043@rgipt.ac.in', 'mohitrkumar2512@gmail.com')
ORDER BY email;

-- Expected output:
-- ✅ verification_tokens table with 3 columns (identifier, token, expires)
-- ✅ 3 users with is_verified = TRUE
