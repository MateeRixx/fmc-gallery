-- Migration: Create otp_codes table for email verification
-- Purpose: Store temporary OTP codes for user registration verification

CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('head', 'co_head', 'executive', 'member')),
  full_name TEXT NOT NULL,
  otp_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '10 minutes',
  verified_at TIMESTAMP WITH TIME ZONE,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 5,
  is_used BOOLEAN DEFAULT FALSE,
  invitation_token_id UUID REFERENCES invitations(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_otp_codes_email ON otp_codes(email);
CREATE INDEX idx_otp_codes_otp_code ON otp_codes(otp_code);
CREATE INDEX idx_otp_codes_is_used ON otp_codes(is_used);
CREATE INDEX idx_otp_codes_expires_at ON otp_codes(expires_at);

-- Add comment for documentation
COMMENT ON TABLE otp_codes IS 'Temporary OTP codes for user registration. Codes expire after 10 minutes. Max 5 attempts before locking.';
