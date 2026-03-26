-- Migration: Add face crop support and improve clustering
-- Purpose: Store reference to specific face for cropped thumbnails and better cluster quality

-- Add cover_face_id to reference the specific face used for the cluster thumbnail
ALTER TABLE face_clusters
  ADD COLUMN IF NOT EXISTS cover_face_id BIGINT REFERENCES face_embeddings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_face_clusters_cover_face_id
  ON face_clusters(cover_face_id);

-- Add comment for clarity
COMMENT ON COLUMN face_clusters.cover_face_id IS 'Reference to face_embeddings row for cropped face thumbnail';
