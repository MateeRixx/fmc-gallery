-- ============================================================================
-- Add cluster quality tracking columns to face_clusters
-- ============================================================================

ALTER TABLE face_clusters
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_audited_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;

-- Create index for quality queries
CREATE INDEX IF NOT EXISTS idx_face_clusters_needs_review ON face_clusters(needs_review) WHERE needs_review = TRUE;
CREATE INDEX IF NOT EXISTS idx_face_clusters_member_count ON face_clusters(member_count DESC);

-- Update existing clusters with current member counts
UPDATE face_clusters fc
SET member_count = (
  SELECT COUNT(*)
  FROM face_embeddings fe
  WHERE fe.cluster_id = fc.id
);

COMMENT ON COLUMN face_clusters.needs_review IS 'Flag indicating cluster has low internal similarity and may need splitting';
COMMENT ON COLUMN face_clusters.last_audited_at IS 'Last time cluster quality was audited';
COMMENT ON COLUMN face_clusters.member_count IS 'Cached count of faces in this cluster - kept in sync to avoid COUNT queries';
