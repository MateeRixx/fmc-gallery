-- Check if verification_tokens table exists and is working
-- Run this in Supabase SQL Editor

-- 1. Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'verification_tokens'
) AS table_exists;

-- 2. Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'verification_tokens'
ORDER BY ordinal_position;

-- 3. Check if there are any verification tokens
SELECT COUNT(*) as token_count FROM verification_tokens;

-- 4. Show recent tokens (last 5)
SELECT identifier, token, expires, 
       CASE 
         WHEN expires > NOW() THEN 'VALID'
         ELSE 'EXPIRED'
       END as status
FROM verification_tokens
ORDER BY expires DESC
LIMIT 5;
