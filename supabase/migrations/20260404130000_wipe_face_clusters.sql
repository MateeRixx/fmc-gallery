-- Migration: Wipe existing unsupervised face clusters and link clusters to users
-- Purpose: Shift to Supervised Identity Tagging using user signups

BEGIN;

-- 1. Wipe out existing unsupervised face clusters and cascading face embeddings
TRUNCATE TABLE face_clusters CASCADE;
TRUNCATE TABLE face_embeddings CASCADE;

-- 2. Add user_id column to face_clusters to map directly to signed-up users
ALTER TABLE face_clusters ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- 3. Pre-create an "Event" to act as a container for Profile Photos
INSERT INTO events (title, slug, description, date, is_published)
VALUES ('Profile Photos', 'profile-photos', 'System event for user profile photos used in identity tagging', NOW(), false)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
