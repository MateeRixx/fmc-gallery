-- Migration: Create verification_tokens table for NextAuth email provider
-- Purpose: Store temporary verification tokens for email magic link authentication
-- NextAuth expects this exact schema for the VerificationToken adapter

BEGIN;

-- Create verification_tokens table (NextAuth standard schema)
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMP WITH TIME ZONE NOT NULL,

  PRIMARY KEY (identifier, token)
);

-- Index for efficient token lookup
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires
  ON verification_tokens(expires);

-- Add comment for documentation
COMMENT ON TABLE verification_tokens IS 'NextAuth verification tokens for email provider. Stores temporary magic link tokens with email (identifier) and expiration time.';

COMMIT;
