-- Migration: Create role_default_permissions table
-- Purpose: Define default permissions automatically assigned to each role

CREATE TABLE IF NOT EXISTS role_default_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL UNIQUE CHECK (role IN ('head', 'co_head', 'executive', 'member')),
  permissions TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default permissions for each role
INSERT INTO role_default_permissions (role, permissions) VALUES
  ('head', ARRAY[
    'canAddEvents',
    'canEditEvents',
    'canDeleteEvents',
    'canUploadPhotos',
    'canDeletePhotos',
    'canManageMembers',
    'canGrantPermissions',
    'canViewAnalytics',
    'canAccessAdminPanel'
  ]),
  ('co_head', ARRAY[
    'canAddEvents',
    'canEditEvents',
    'canDeleteEvents',
    'canUploadPhotos',
    'canDeletePhotos',
    'canManageMembers',
    'canGrantPermissions',
    'canViewAnalytics',
    'canAccessAdminPanel'
  ]),
  ('executive', ARRAY[
    'canAddEvents',
    'canEditEvents',
    'canUploadPhotos',
    'canViewAnalytics',
    'canAccessAdminPanel'
  ]),
  ('member', ARRAY[]::TEXT[])
ON CONFLICT (role) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE role_default_permissions IS 'Default permissions assigned to each role. These are automatically applied when a user is created with that role.';
