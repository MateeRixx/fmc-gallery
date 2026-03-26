-- Migration: Add AWS Rekognition fields for face indexing
-- Purpose: Support server-side AWS face indexing and clustering

ALTER TABLE face_embeddings
  ADD COLUMN IF NOT EXISTS aws_face_id TEXT,
  ADD COLUMN IF NOT EXISTS aws_indexed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS detection_method TEXT DEFAULT 'client';

-- AWS mode can store face IDs without a local embedding vector.
ALTER TABLE face_embeddings
  ALTER COLUMN embedding DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_face_embeddings_aws_face_id
  ON face_embeddings(aws_face_id);

CREATE INDEX IF NOT EXISTS idx_face_embeddings_detection_method
  ON face_embeddings(detection_method);
