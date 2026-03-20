-- ============================================================================
-- FACE DETECTION TABLES
-- ============================================================================

-- Table: face_clusters
-- Stores unique person clusters with centroids and metadata
CREATE TABLE IF NOT EXISTS face_clusters (
  id                   BIGSERIAL PRIMARY KEY,
  canonical_embedding  TEXT NOT NULL,  -- 128-dimensional vector as "[x,y,z,...]"
  face_count           INTEGER DEFAULT 1,
  cover_photo_id       BIGINT REFERENCES photos(id) ON DELETE SET NULL,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_face_clusters_updated_at ON face_clusters(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_face_clusters_face_count ON face_clusters(face_count DESC);


-- Table: face_embeddings
-- Stores detected faces with embeddings and bounding boxes
CREATE TABLE IF NOT EXISTS face_embeddings (
  id             BIGSERIAL PRIMARY KEY,
  photo_id       BIGINT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  event_id       BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  embedding      TEXT NOT NULL,  -- 128-dimensional vector as "[x,y,z,...]"
  bbox           JSONB NOT NULL, -- {x, y, width, height} normalized 0-1
  quality_score  REAL DEFAULT 0,
  cluster_id     BIGINT REFERENCES face_clusters(id) ON DELETE SET NULL,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_face_embeddings_photo_id ON face_embeddings(photo_id);
CREATE INDEX IF NOT EXISTS idx_face_embeddings_event_id ON face_embeddings(event_id);
CREATE INDEX IF NOT EXISTS idx_face_embeddings_cluster_id ON face_embeddings(cluster_id);
CREATE INDEX IF NOT EXISTS idx_face_embeddings_quality_score ON face_embeddings(quality_score DESC);


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE face_clusters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read face clusters" ON face_clusters;
DROP POLICY IF EXISTS "Service role can manage face clusters" ON face_clusters;

CREATE POLICY "Anyone can read face clusters"
  ON face_clusters FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage face clusters"
  ON face_clusters FOR ALL
  USING (auth.role() = 'service_role');


ALTER TABLE face_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read face embeddings" ON face_embeddings;
DROP POLICY IF EXISTS "Service role can manage face embeddings" ON face_embeddings;

CREATE POLICY "Anyone can read face embeddings"
  ON face_embeddings FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage face embeddings"
  ON face_embeddings FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================================
-- DATABASE FUNCTION: search_similar_faces
-- ============================================================================

CREATE OR REPLACE FUNCTION search_similar_faces(
  query_embedding TEXT,
  filter_event_id BIGINT DEFAULT NULL,
  match_threshold REAL DEFAULT 0.35,
  match_limit INT DEFAULT 60
)
RETURNS TABLE (
  face_id BIGINT,
  photo_id BIGINT,
  event_id BIGINT,
  bbox JSONB,
  photo_url TEXT,
  similarity REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  query_vec REAL[];
  embedding_vec REAL[];
  dot_product REAL;
  norm_a REAL;
  norm_b REAL;
  cosine_sim REAL;
  rec RECORD;
  results_count INT := 0;
BEGIN
  -- Parse query embedding from text format "[x,y,z,...]"
  query_embedding := TRIM(query_embedding);
  IF NOT (query_embedding ~ '^\[.*\]$') THEN
    RAISE EXCEPTION 'Invalid embedding format';
  END IF;

  query_embedding := SUBSTRING(query_embedding FROM 2 FOR LENGTH(query_embedding) - 2);
  query_vec := string_to_array(query_embedding, ',')::REAL[];

  IF array_length(query_vec, 1) != 128 THEN
    RAISE EXCEPTION 'Embedding must be 128 dimensions';
  END IF;

  -- Calculate norm of query vector
  norm_a := 0;
  FOR i IN 1..128 LOOP
    norm_a := norm_a + (query_vec[i] * query_vec[i]);
  END LOOP;
  norm_a := SQRT(norm_a);

  IF norm_a = 0 THEN
    RAISE EXCEPTION 'Query embedding has zero norm';
  END IF;

  -- Loop through face embeddings and calculate similarity
  FOR rec IN
    SELECT
      fe.id,
      fe.photo_id,
      fe.event_id,
      fe.bbox,
      fe.embedding,
      p.path
    FROM face_embeddings fe
    JOIN photos p ON p.id = fe.photo_id
    WHERE (filter_event_id IS NULL OR fe.event_id = filter_event_id)
  LOOP
    -- Parse embedding vector
    embedding_vec := string_to_array(
      SUBSTRING(rec.embedding FROM 2 FOR LENGTH(rec.embedding) - 2),
      ','
    )::REAL[];

    IF array_length(embedding_vec, 1) != 128 THEN
      CONTINUE;
    END IF;

    -- Calculate dot product and norm
    dot_product := 0;
    norm_b := 0;
    FOR i IN 1..128 LOOP
      dot_product := dot_product + (query_vec[i] * embedding_vec[i]);
      norm_b := norm_b + (embedding_vec[i] * embedding_vec[i]);
    END LOOP;
    norm_b := SQRT(norm_b);

    IF norm_b = 0 THEN
      CONTINUE;
    END IF;

    -- Cosine similarity (1 = identical, 0 = orthogonal, -1 = opposite)
    cosine_sim := dot_product / (norm_a * norm_b);

    -- Convert cosine similarity to distance (0 = identical, 2 = opposite)
    -- Then check if within threshold
    IF (1 - cosine_sim) <= match_threshold THEN
      face_id := rec.id;
      photo_id := rec.photo_id;
      event_id := rec.event_id;
      bbox := rec.bbox;
      photo_url := rec.path;
      similarity := cosine_sim;

      RETURN NEXT;

      results_count := results_count + 1;
      IF results_count >= match_limit THEN
        EXIT;
      END IF;
    END IF;
  END LOOP;

  RETURN;
END;
$$;
