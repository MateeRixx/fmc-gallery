# Testing Guide: Face Clustering Fix

## Prerequisites

### 1. Apply Database Migration
```bash
# Navigate to project root
cd c:\D-Drive\Projects\FMC-Gallery\fmc-gallery

# Apply the migration
supabase db push

# OR if using migration files directly:
supabase migration up
```

Verify migration applied:
```sql
-- Check new columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'face_clusters'
AND column_name IN ('needs_review', 'last_audited_at', 'member_count');
```

### 2. Clear Existing Clusters (Optional but Recommended)
```bash
# Make a backup first!
# Then clear old fragmented clusters
```

```sql
UPDATE face_embeddings SET cluster_id = NULL;
DELETE FROM face_clusters WHERE id > 0;
```

---

## Test 1: Transitivity Fix (The Core Problem)

### **Goal:** Verify that faces are correctly grouped when transitivity is involved

### **Setup:**
Prepare 10-15 photos of the **same person** with varied conditions:
- Different angles (profile, front, 3/4 view)
- Different lighting (bright, dim, backlit)
- Different expressions (smiling, neutral, laughing)
- Different distances (close-up, medium, far)

### **Steps:**

1. **Clean slate:**
```bash
# Go to your admin dashboard: /admin/faces
# Click "Full Recluster" with reset: true to clear everything
```

2. **Upload test photos:**
   - Go to event page (e.g., `/events/test-event`)
   - Click "+" button
   - Upload all 10-15 photos of the same person
   - Wait for processing to complete

3. **Check clustering result:**
```sql
-- Count how many clusters were created for this batch
SELECT
  c.id as cluster_id,
  c.member_count,
  c.cover_photo_id,
  COUNT(fe.id) as actual_faces
FROM face_clusters c
LEFT JOIN face_embeddings fe ON fe.cluster_id = c.id
GROUP BY c.id
ORDER BY c.member_count DESC;
```

### **Expected Result:**
- ✅ **All faces in 1 cluster** (or max 2 if person has dramatically different appearances)
- ❌ **Before fix:** Would create 3-5 fragmented clusters

### **Visual Verification:**
1. Go to `/people` page
2. Should see ONE person card (not multiple cards of same person)
3. Click the person → should show all 10-15 photos

---

## Test 2: Incremental Merge (Small Upload Optimization)

### **Goal:** Verify incremental merge works faster than full recluster

### **Steps:**

1. **First batch (establish baseline):**
   - Upload 10 photos of Person A
   - Note: This creates initial clusters

2. **Second batch (incremental merge test):**
   - Upload 3-5 NEW photos of Person A (different poses)
   - Watch the status messages in upload modal
   - Should see: "Merging X new face(s) into clusters..."

3. **Check if faces merged correctly:**
```sql
SELECT
  c.id,
  c.member_count,
  fe.id as face_id,
  fe.photo_id
FROM face_clusters c
JOIN face_embeddings fe ON fe.cluster_id = c.id
WHERE c.cover_photo_id IN (
  SELECT id FROM photos
  WHERE created_at > NOW() - INTERVAL '10 minutes'
)
ORDER BY c.id, fe.id;
```

### **Expected Result:**
- ✅ New faces assigned to **existing cluster** (member_count increased)
- ✅ Faster completion (~3-5 seconds vs 30+ seconds)
- ❌ **Before fix:** Would create separate clusters or fail to merge

### **Timing Test:**
```typescript
// Open browser console during upload
// Check network time for /api/admin/faces/recluster
// Incremental mode should be <5 seconds
```

---

## Test 3: Large Batch Full Recluster

### **Goal:** Verify large uploads trigger full recluster instead of incremental

### **Steps:**

1. **Upload 50+ photos:**
   - Prepare 50-60 photos (can be of multiple people)
   - Upload all at once
   - Watch status message

2. **Verify full recluster triggered:**
   - Should see: "Running full recluster (large batch)..."
   - NOT: "Merging X new faces..."

3. **Check clustering quality:**
```sql
SELECT
  COUNT(DISTINCT cluster_id) as total_clusters,
  COUNT(*) as total_faces,
  AVG(quality_score) as avg_quality
FROM face_embeddings
WHERE cluster_id IS NOT NULL;
```

### **Expected Result:**
- ✅ Status shows "full recluster" for 50+ photos
- ✅ All faces clustered correctly despite large batch
- ❌ Incremental merge should NOT trigger for large batches

---

## Test 4: Cluster Quality Auditing

### **Goal:** Verify quality audit detects and flags bad clusters

### **Setup:**
1. Create a "bad cluster" by manually forcing different people into same cluster:
```sql
-- Intentionally create a bad cluster for testing
UPDATE face_embeddings
SET cluster_id = 1
WHERE id IN (
  SELECT id FROM face_embeddings
  ORDER BY RANDOM()
  LIMIT 20
);
```

### **Steps:**

1. **Trigger audit via API:**
```bash
# Using curl or Postman
curl -X POST http://localhost:3000/api/admin/faces/recluster \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "full",
    "method": "aws",
    "threshold": 0.35,
    "reset": false,
    "audit_quality": true,
    "auto_split": false
  }'
```

2. **Check if bad cluster flagged:**
```sql
SELECT
  id,
  member_count,
  needs_review,
  last_audited_at
FROM face_clusters
WHERE needs_review = true;
```

### **Expected Result:**
- ✅ Poorly-grouped cluster has `needs_review = true`
- ✅ `last_audited_at` timestamp is recent
- ✅ Quality score < 0.5 reported in audit

---

## Test 5: Auto-Split Functionality

### **Goal:** Verify auto-split breaks bad clusters into sub-groups

### **Steps:**

1. **Trigger audit with auto-split:**
```bash
curl -X POST http://localhost:3000/api/admin/faces/recluster \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "full",
    "method": "aws",
    "threshold": 0.35,
    "reset": false,
    "audit_quality": true,
    "auto_split": true
  }'
```

2. **Verify cluster was split:**
```sql
-- Before split: 1 cluster with 20 faces
-- After split: 2-3 clusters with better grouping

SELECT
  c.id,
  c.member_count,
  c.needs_review,
  COUNT(fe.id) as actual_faces
FROM face_clusters c
LEFT JOIN face_embeddings fe ON fe.cluster_id = c.id
GROUP BY c.id
ORDER BY c.created_at DESC
LIMIT 10;
```

### **Expected Result:**
- ✅ Original bad cluster deleted
- ✅ 2+ new sub-clusters created with better grouping
- ✅ Each sub-cluster has `needs_review = false`

---

## Test 6: Edge Cases & Error Handling

### **Test 6A: SearchFaces Failures**

**Goal:** Verify clustering continues even if some faces fail

**Steps:**
1. Temporarily break AWS credentials (wrong key)
2. Upload photos → some should fail, others succeed
3. Check logs for "search error" messages
4. Verify faces that succeeded still got clustered

**Expected:**
- ✅ Non-failing faces still cluster correctly
- ✅ Errors logged but don't abort entire process

---

### **Test 6B: Duplicate Uploads**

**Goal:** Verify same photo uploaded twice doesn't break clustering

**Steps:**
1. Upload photo of Person A
2. Upload same photo again (duplicate)
3. Check if both faces assigned to same cluster

**Expected:**
- ✅ Both faces in same cluster (high similarity)
- ✅ No duplicate cluster creation

---

### **Test 6C: No Faces Detected**

**Goal:** Verify graceful handling when AWS finds no faces

**Steps:**
1. Upload landscape photo (no people)
2. Upload photo of person from far away (too small)
3. Check response

**Expected:**
- ✅ No error thrown
- ✅ `indexed_faces: 0` returned
- ✅ No empty clusters created

---

### **Test 6D: Mixed Quality Faces**

**Goal:** Verify low-quality faces are skipped

**Steps:**
1. Upload mix of clear faces and blurry faces
2. Set `min_quality: 0.5` in recluster
3. Check which faces got clustered

**Expected:**
- ✅ Only faces with `quality_score >= 0.5` clustered
- ✅ Low-quality faces have `cluster_id = NULL`

---

## Test 7: Performance Benchmarks

### **Measure clustering speed:**

```typescript
// In browser console:
async function testClusteringSpeed(mode, faceCount) {
  const start = Date.now();

  const response = await fetch('/api/admin/faces/recluster', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('fmc-auth-token')}`
    },
    body: JSON.stringify({
      mode: mode,
      method: 'aws',
      threshold: 0.35,
      min_quality: 0.45,
      reset: false
    })
  });

  const data = await response.json();
  const elapsed = Date.now() - start;

  console.log(`${mode} mode with ${faceCount} faces: ${elapsed}ms`);
  return data;
}

// Test incremental (should be fast)
await testClusteringSpeed('incremental', 10);

// Test full (will be slower but thorough)
await testClusteringSpeed('full', 100);
```

### **Expected Results:**

| Mode | Face Count | Expected Time |
|------|-----------|---------------|
| Incremental | <20 faces | 3-8 seconds |
| Full | 100 faces | 20-40 seconds |
| Full | 500 faces | 60-120 seconds |

---

## Test 8: Visual Dashboard Test

### **Create test admin page to monitor clustering:**

```typescript
// In admin dashboard, add monitoring section:

async function getClusteringStats() {
  const response = await fetch('/api/admin/faces/stats', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.json();
}

// Display:
// - Total clusters
// - Clusters needing review
// - Average faces per cluster
// - Last audit time
```

### **Check metrics:**
```sql
SELECT
  COUNT(*) as total_clusters,
  SUM(member_count) as total_faces,
  AVG(member_count) as avg_faces_per_cluster,
  SUM(CASE WHEN needs_review THEN 1 ELSE 0 END) as clusters_needing_review
FROM face_clusters;
```

---

## Test 9: Real-World Scenario

### **Simulate actual event workflow:**

1. **Create new event:** "Test Wedding 2026"

2. **Upload in phases (realistic):**
   - Day 1: Upload 30 ceremony photos
   - Day 2: Upload 25 reception photos
   - Day 3: Upload 15 candid photos

3. **Check clustering after each phase:**
```sql
SELECT
  c.id,
  c.member_count,
  c.needs_review,
  MIN(fe.created_at) as first_face,
  MAX(fe.created_at) as last_face
FROM face_clusters c
JOIN face_embeddings fe ON fe.cluster_id = c.id
GROUP BY c.id
ORDER BY c.member_count DESC;
```

4. **Verify continuity:**
   - Same person's faces from Day 1 and Day 3 in same cluster?
   - Incremental merge worked across multiple upload sessions?

### **Expected Result:**
- ✅ Person appearing in multiple days → 1 cluster
- ✅ No duplicate clusters created across sessions
- ✅ member_count increases incrementally

---

## Test 10: Rollback Test (Safety)

### **Goal:** Ensure you can rollback if something goes wrong

### **Steps:**

1. **Backup before migration:**
```sql
-- Backup face_clusters
CREATE TABLE face_clusters_backup AS
SELECT * FROM face_clusters;

-- Backup face_embeddings
CREATE TABLE face_embeddings_backup AS
SELECT * FROM face_embeddings;
```

2. **Test rollback:**
```sql
-- Restore from backup if needed
TRUNCATE face_clusters;
TRUNCATE face_embeddings CASCADE;

INSERT INTO face_clusters SELECT * FROM face_clusters_backup;
INSERT INTO face_embeddings SELECT * FROM face_embeddings_backup;
```

---

## Debugging Checklist

### **If clustering seems broken:**

1. **Check migration applied:**
```sql
SELECT * FROM face_clusters LIMIT 1;
-- Should have: needs_review, last_audited_at, member_count columns
```

2. **Check AWS credentials:**
```bash
# In .env.local
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REKOGNITION_COLLECTION_ID=fmc-gallery-faces
```

3. **Check API logs:**
```bash
# Look for clustering progress logs in terminal
# Should see: "Pass 1: Searching X/Y faces..."
# Should see: "Pass 2: Applying Union-Find..."
```

4. **Verify face indexing working:**
```sql
SELECT
  COUNT(*) as total_faces,
  COUNT(aws_face_id) as aws_indexed,
  COUNT(cluster_id) as clustered
FROM face_embeddings;
```

5. **Check for orphaned faces:**
```sql
-- Faces without clusters (might need reclustering)
SELECT COUNT(*)
FROM face_embeddings
WHERE cluster_id IS NULL
AND aws_face_id IS NOT NULL;
```

---

## Success Criteria Summary

### ✅ **Core Fix Verified:**
- [ ] Same person in multiple poses → 1 cluster (not 3-5)
- [ ] Transitivity works: A→B + B→C = A,B,C together

### ✅ **Performance Verified:**
- [ ] Small uploads (<50 photos) use incremental merge (~3s)
- [ ] Large uploads (≥50 photos) use full recluster (~30s)

### ✅ **Quality Verified:**
- [ ] Bad clusters flagged with `needs_review = true`
- [ ] Auto-split breaks bad clusters into sub-groups
- [ ] Quality score accurately reflects cluster cohesion

### ✅ **Robustness Verified:**
- [ ] Handles SearchFaces failures gracefully
- [ ] No duplicate clusters from same person
- [ ] Low-quality faces correctly skipped

---

## Quick Smoke Test (5 minutes)

**For rapid verification after deployment:**

```bash
# 1. Upload 5 photos of same person
# 2. Check /people page → should see 1 card
# 3. Upload 2 more photos of same person
# 4. Refresh /people → still 1 card, now with 7 photos
# 5. Check database:
```

```sql
SELECT
  COUNT(DISTINCT cluster_id) as clusters,
  COUNT(*) as faces
FROM face_embeddings
WHERE created_at > NOW() - INTERVAL '5 minutes';

-- Expected: clusters=1, faces=7
```

**If this passes, your fix is working! 🎉**
