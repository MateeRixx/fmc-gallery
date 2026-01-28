/**
 * DATABASE SCHEMA FOR RBAC SYSTEM
 * 
 * This file documents the Supabase PostgreSQL schema needed for the RBAC system.
 * Copy and paste these SQL commands into your Supabase SQL editor.
 * 
 * TABLES:
 * 1. users - Main user table with roles and permissions
 * 2. role_audit_log - Optional: Track all role changes
 */

-- ============================================================================
-- TABLE: users
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  -- Auth info
  id UUID PRIMARY KEY NOT NULL,  -- UUID from Supabase auth
  email TEXT NOT NULL UNIQUE,
  
  -- Role and permissions
  role TEXT NOT NULL CHECK (role IN ('head', 'co_head', 'executive', 'member', 'inactive')),
  permissions TEXT[] DEFAULT '{}',  -- Array of permission strings
  
  -- User info
  full_name TEXT,
  avatar_url TEXT,
  
  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,  -- Who invited this user
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Role change tracking (for yearly handover)
  role_updated_at TIMESTAMP WITH TIME ZONE,
  role_updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Indexes for common queries
  created_at DESC  -- For ordering by creation date
);

-- Create an index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- Create an index on role for faster filtering
CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- TABLE: role_audit_log (Optional but Recommended)
-- ============================================================================
-- This table tracks all role changes for audit purposes
-- Delete old records periodically to manage storage

CREATE TABLE IF NOT EXISTS role_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who made the change
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- What changed
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  previous_role TEXT NOT NULL,
  new_role TEXT NOT NULL,
  
  -- Reason (optional)
  reason TEXT,
  
  -- Indexes
  INDEX ON changed_at DESC,
  INDEX ON user_id
);

-- ============================================================================
-- ENUM/TYPE DEFINITIONS (for reference, handled in TypeScript)
-- ============================================================================

-- User Roles:
-- head         - 1 person, full supreme admin
-- co_head      - 1 person, full supreme admin
-- executive    - multiple, limited permissions
-- member       - normal user, read-only
-- inactive     - no access

-- Permissions (stored as array of strings):
-- canAddEvents          - Can create new events
-- canEditEvents         - Can edit all events
-- canDeleteEvents       - Can delete all events
-- canUploadPhotos       - Can upload photos
-- canDeletePhotos       - Can delete photos
-- canManageMembers      - Can invite/remove members
-- canGrantPermissions   - Can grant permissions to others
-- canViewAnalytics      - Can view analytics/statistics
-- canAccessAdminPanel   - Can access admin dashboard

-- ============================================================================
-- DEFAULT PERMISSIONS BY ROLE
-- ============================================================================

-- Head/Co-Head: All permissions (implicit, don't store in DB)
-- Executive: Custom permissions (stored in array)
-- Member: No permissions (empty array)
-- Inactive: No permissions (empty array)

-- ============================================================================
-- YEARLY HANDOVER WORKFLOW (SQL Example)
-- ============================================================================

-- STEP 1: Promote old Co-Head to new Head
UPDATE users SET 
  role = 'head',
  role_updated_at = NOW(),
  role_updated_by = 'ADMIN_USER_ID'
WHERE id = 'OLD_CO_HEAD_ID';

-- Old Head becomes Executive
UPDATE users SET 
  role = 'executive',
  permissions = '{"canAddEvents", "canUploadPhotos"}',  -- Default executive permissions
  role_updated_at = NOW(),
  role_updated_by = 'ADMIN_USER_ID'
WHERE id = 'OLD_HEAD_ID';

-- STEP 2: Promote old Executive to new Co-Head
UPDATE users SET 
  role = 'co_head',
  role_updated_at = NOW(),
  role_updated_by = 'ADMIN_USER_ID'
WHERE id = 'OLD_EXECUTIVE_ID';

-- STEP 3: Add new Executives (via app or direct INSERT)
INSERT INTO users (id, email, role, permissions, created_at)
VALUES (
  gen_random_uuid(),
  'neweecutive@club.com',
  'executive',
  '{"canAddEvents", "canUploadPhotos"}',
  NOW()
);

-- ============================================================================
-- VIEW: Active Users (Optional)
-- ============================================================================

CREATE OR REPLACE VIEW active_users AS
SELECT * FROM users
WHERE role != 'inactive'
ORDER BY created_at DESC;

-- Usage: SELECT * FROM active_users;

-- ============================================================================
-- USEFUL QUERIES
-- ============================================================================

-- Get current Head
-- SELECT * FROM users WHERE role = 'head';

-- Get current Co-Head
-- SELECT * FROM users WHERE role = 'co_head';

-- Get all active Executives
-- SELECT * FROM users WHERE role = 'executive' AND created_at IS NOT NULL;

-- Get all inactive users
-- SELECT * FROM users WHERE role = 'inactive';

-- Get users with specific permission
-- SELECT * FROM users WHERE 'canManageMembers' = ANY(permissions);

-- Get role change history for a user
-- SELECT * FROM role_audit_log WHERE user_id = 'USER_ID' ORDER BY changed_at DESC;

-- ============================================================================
-- SECURITY NOTES
-- ============================================================================

-- 1. Enable RLS (Row Level Security) on both tables
-- 2. Only authenticated users can view other users (with limitations by role)
-- 3. Only Head/Co-Head can modify roles
-- 4. Users cannot modify their own role
-- 5. Audit all changes with role_audit_log

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES (Optional but Recommended)
-- ============================================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_audit_log ENABLE ROW LEVEL SECURITY;

-- Everyone can view their own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Head/Co-Head can view all users
CREATE POLICY "Supreme admins can view all users"
  ON users FOR SELECT
  USING ((SELECT role FROM users WHERE id = auth.uid() LIMIT 1) IN ('head', 'co_head'));

-- Only Head/Co-Head can update roles
CREATE POLICY "Only supreme admins can update roles"
  ON users FOR UPDATE
  USING ((SELECT role FROM users WHERE id = auth.uid() LIMIT 1) IN ('head', 'co_head'));

-- Audit log is append-only (no deletes without special privileges)
CREATE POLICY "Audit log is immutable"
  ON role_audit_log FOR DELETE
  USING (false);  -- No one can delete
