-- Manual Script: Insert Admin Users from Admins Table to Users Table
-- Run this in Supabase SQL Editor

-- This script inserts the three admin users shown in the screenshot
-- into the users table so they can sign in with email magic links

INSERT INTO users (
  id,
  email,
  role,
  user_type,
  full_name,
  permissions,
  created_at,
  is_verified,
  verified_at
)
VALUES
  -- Admin 1: 23IT3028@rgipt.ac.in
  (
    gen_random_uuid(),
    '23it3028@rgipt.ac.in',
    'head',  -- Change this based on their actual role
    'ADMIN',
    '23IT3028',  -- Change to actual name if known
    ARRAY['manage_users', 'manage_events', 'manage_photos']::TEXT[],
    '2026-01-31 07:10:16+00',
    TRUE,
    NOW()
  ),
  -- Admin 2: 23IT3043@rgipt.ac.in
  (
    gen_random_uuid(),
    '23it3043@rgipt.ac.in',
    'co_head',  -- Change this based on their actual role
    'ADMIN',
    '23IT3043',  -- Change to actual name if known
    ARRAY['manage_events', 'manage_photos']::TEXT[],
    '2026-01-31 07:10:33+00',
    TRUE,
    NOW()
  ),
  -- Admin 3: mohitrkumar2512@gmail.com
  (
    gen_random_uuid(),
    'mohitrkumar2512@gmail.com',
    'head',  -- Change this based on their actual role
    'ADMIN',
    'Mohit Kumar',  -- Change to actual name if known
    ARRAY['manage_users', 'manage_events', 'manage_photos']::TEXT[],
    '2026-01-20 17:57:50.877693+00',
    TRUE,
    NOW()
  )
ON CONFLICT (email) DO UPDATE SET
  user_type = EXCLUDED.user_type,
  is_verified = EXCLUDED.is_verified,
  verified_at = EXCLUDED.verified_at;

-- Verification query
SELECT id, email, role, user_type, full_name, is_verified, created_at 
FROM users 
WHERE email IN (
  '23it3028@rgipt.ac.in', 
  '23it3043@rgipt.ac.in', 
  'mohitrkumar2512@gmail.com'
)
ORDER BY email;
