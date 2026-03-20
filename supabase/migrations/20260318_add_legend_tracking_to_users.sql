-- Migration: Add legend and grace period tracking to users table
-- Purpose: Support HEAD role succession with graceful demotion to LEGEND status

ALTER TABLE users ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_legend BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS legend_since TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenure_start TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenure_end TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- Indexes for queries
CREATE INDEX IF NOT EXISTS idx_users_is_legend ON users(is_legend);
CREATE INDEX IF NOT EXISTS idx_users_grace_period_ends_at ON users(grace_period_ends_at);
CREATE INDEX IF NOT EXISTS idx_users_role_is_legend ON users(role, is_legend);

-- Add comments
COMMENT ON COLUMN users.grace_period_ends_at IS 'When an old HEAD''s 3-day grace period expires, they auto-demote to LEGEND';
COMMENT ON COLUMN users.is_legend IS 'True if user is a retired HEAD (appears in Hall of Fame)';
COMMENT ON COLUMN users.legend_since IS 'When the user became a LEGEND';
COMMENT ON COLUMN users.tenure_start IS 'When the user started their tenure as HEAD';
COMMENT ON COLUMN users.tenure_end IS 'When the user ended their tenure as HEAD';
COMMENT ON COLUMN users.is_verified IS 'True if user verified their email via OTP';
COMMENT ON COLUMN users.verified_at IS 'When the user verified their email';
