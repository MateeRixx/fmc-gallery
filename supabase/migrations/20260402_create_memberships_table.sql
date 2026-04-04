-- Migration: Create memberships table for role lifecycle management
-- Purpose: Decouple roles from users table, track membership status and dates

BEGIN;

-- Create memberships table
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  role_level INT NOT NULL CHECK (role_level IN (0, 1, 2, 3)),
  -- role_level: 0=VISITOR, 1=EXECUTIVE, 2=CO_HEAD, 3=HEAD
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_role_level ON memberships(role_level);
CREATE INDEX idx_memberships_is_active ON memberships(is_active);

-- Add comment
COMMENT ON TABLE memberships IS 'Tracks active memberships with role levels. Users can be inactive without deletion.';
COMMENT ON COLUMN memberships.role_level IS '0=VISITOR, 1=EXECUTIVE, 2=CO_HEAD, 3=HEAD';

-- Migrate existing roles from users table to memberships
-- For each user with a role, create a membership
INSERT INTO memberships (user_id, role_level, is_active, start_date)
SELECT
  id,
  CASE
    WHEN role = 'head' THEN 3
    WHEN role = 'co_head' THEN 2
    WHEN role = 'executive' THEN 1
    WHEN role = 'member' THEN 1  -- member becomes executive for backward compatibility
    WHEN role = 'inactive' THEN 0
    ELSE 0
  END as role_level,
  role != 'inactive' as is_active,
  COALESCE(created_at, NOW())
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM memberships m WHERE m.user_id = u.id
);

-- Update users with visitor status where no membership
UPDATE users u
SET role = NULL
WHERE NOT EXISTS (
  SELECT 1 FROM memberships m WHERE m.user_id = u.id
);

COMMIT;
