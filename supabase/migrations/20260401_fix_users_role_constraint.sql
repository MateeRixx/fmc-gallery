-- Migration: Fix users_role Check Constraint
-- Purpose: The existing users_role check constraint was incorrectly preventing valid roles like 'member', 'executive', and 'co_head' from being inserted.

BEGIN;

-- Drop the broken constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add the corrected check constraint that allows all valid roles (or NULL for visitors)
ALTER TABLE users ADD CONSTRAINT users_role 
  CHECK (role IN ('head', 'co_head', 'executive', 'member', 'inactive') OR role IS NULL);

COMMIT;
