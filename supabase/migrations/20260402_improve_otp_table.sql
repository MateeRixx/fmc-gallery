-- Migration: Improve OTP verification table for production OTP auth
-- Purpose: Enhance OTP storage with better security and lifecycle management

BEGIN;

-- Add missing columns to otp_codes if they don't exist
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS used_by UUID;

-- Add more indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_otp_codes_verified ON otp_codes(verified);
CREATE INDEX IF NOT EXISTS idx_otp_codes_created_at ON otp_codes(created_at);

-- Add rate limiting constraint (max 3 active OTPs per email at once)
-- This is enforced via application logic

-- Update comment
COMMENT ON TABLE otp_codes IS 'OTP codes for email verification during authentication. Auto-expires after 10 minutes. Max 5 verification attempts allowed.';

-- Function to clean expired OTP codes (call periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_otp_codes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM otp_codes
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant cleanup function to service role
GRANT EXECUTE ON FUNCTION cleanup_expired_otp_codes() TO service_role;

COMMIT;
