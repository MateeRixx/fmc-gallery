-- ============================================================================
-- FMC GALLERY — FULL DATABASE SCHEMA
-- Run this entire file in Supabase SQL Editor (one paste, then Run)
-- ============================================================================


-- ============================================================================
-- TABLE: events
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  id            BIGSERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT,
  starts_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cover_url     TEXT,
  hero_image_url TEXT,
  is_public     BOOLEAN DEFAULT true,
  user_id       UUID,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);


-- ============================================================================
-- TABLE: photos
-- ============================================================================

CREATE TABLE IF NOT EXISTS photos (
  id         BIGSERIAL PRIMARY KEY,
  event_id   BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  path       TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photos_event_id ON photos(event_id);


-- ============================================================================
-- TABLE: users
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY NOT NULL,
  email            TEXT NOT NULL UNIQUE,
  role             TEXT NOT NULL CHECK (role IN ('head', 'co_head', 'executive', 'member', 'inactive')),
  permissions      TEXT[] DEFAULT '{}',
  full_name        TEXT,
  avatar_url       TEXT,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  role_updated_at  TIMESTAMP WITH TIME ZONE,
  role_updated_by  UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);


-- ============================================================================
-- TABLE: role_audit_log
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by    UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  changed_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  previous_role TEXT NOT NULL,
  new_role      TEXT NOT NULL,
  reason        TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON role_audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_id    ON role_audit_log(user_id);


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- events: publicly readable, only admins can write
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read events"
  ON events FOR SELECT
  USING (true);

CREATE POLICY "Service role can write events"
  ON events FOR ALL
  USING (auth.role() = 'service_role');

-- photos: publicly readable, only admins can write
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read photos"
  ON photos FOR SELECT
  USING (true);

CREATE POLICY "Service role can write photos"
  ON photos FOR ALL
  USING (auth.role() = 'service_role');

-- users: admins only
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to users"
  ON users FOR ALL
  USING (auth.role() = 'service_role');

-- role_audit_log: admins only, append-only
ALTER TABLE role_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to audit log"
  ON role_audit_log FOR ALL
  USING (auth.role() = 'service_role');
