-- ============================================================================
-- FACE DETECTION DATABASE VERIFICATION SCRIPT
-- Run this in Supabase SQL Editor to check if face tables exist
-- ============================================================================

-- 1. Check if face_embeddings table exists
SELECT
  CASE
    WHEN EXISTS (
      SELECT FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename = 'face_embeddings'
    ) THEN '✅ face_embeddings table EXISTS'
    ELSE '❌ face_embeddings table MISSING'
  END AS face_embeddings_status;

-- 2. Check if face_clusters table exists
SELECT
  CASE
    WHEN EXISTS (
      SELECT FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename = 'face_clusters'
    ) THEN '✅ face_clusters table EXISTS'
    ELSE '❌ face_clusters table MISSING'
  END AS face_clusters_status;

-- 3. Check if search_similar_faces function exists
SELECT
  CASE
    WHEN EXISTS (
      SELECT FROM pg_proc
      WHERE proname = 'search_similar_faces'
    ) THEN '✅ search_similar_faces() function EXISTS'
    ELSE '❌ search_similar_faces() function MISSING'
  END AS function_status;

-- 4. Count existing face embeddings (if table exists)
SELECT
  COUNT(*) as total_face_embeddings,
  COUNT(DISTINCT cluster_id) as clusters_with_faces,
  COUNT(*) FILTER (WHERE cluster_id IS NULL) as unassigned_faces
FROM face_embeddings;

-- 5. Count face clusters (if table exists)
SELECT
  COUNT(*) as total_clusters,
  SUM(face_count) as total_faces_in_clusters,
  AVG(face_count) as avg_faces_per_cluster
FROM face_clusters;

-- 6. Check indexes
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('face_embeddings', 'face_clusters')
ORDER BY tablename, indexname;
