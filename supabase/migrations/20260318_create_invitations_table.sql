-- Migration: Create invitations table for role-based access control
-- Purpose: Store invitation tokens for admin role signups (Head, Co-Head)

CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('head', 'co_head', 'executive', 'member')),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '7 days',
  used_at TIMESTAMP WITH TIME ZONE,
  is_used BOOLEAN DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_created_by ON invitations(created_by);
CREATE INDEX idx_invitations_is_used ON invitations(is_used);

-- Add comment for documentation
COMMENT ON TABLE invitations IS 'Stores invitation tokens for admin role signups. Head/Co-Head roles require valid, unused invitation tokens.';
