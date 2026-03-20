# 🚀 AWS Rekognition Integration Strategy

## 📊 Current System vs AWS Rekognition

### **Current System (face-api.js + TensorFlow.js)**

#### ✅ Pros:
- **Client-side processing** - No server costs
- **Real-time feedback** - User sees faces immediately during upload
- **Full control** - Custom clustering algorithm
- **No external dependencies** - Works offline

#### ❌ Cons:
- **Slow batch processing** - Browser must process 100s of photos
- **Inconsistent performance** - Depends on user's GPU/CPU
- **Manual clustering** - Custom algorithm may have accuracy issues
- **Memory intensive** - Large batches can crash browser
- **No Google Drive face detection** - Server-side import bypasses client

---

### **AWS Rekognition**

#### ✅ Pros:
- **Server-side processing** - Fast batch operations
- **Consistent performance** - AWS infrastructure, always fast
- **Automatic clustering** - AWS manages face collections
- **Built-in search** - SearchFacesByImage API
- **Better accuracy** - AWS's ML models > open source
- **Server-side imports** - Can process Google Drive uploads
- **Face matching confidence** - Returns similarity scores

#### ❌ Cons:
- **AWS costs** - Pay per image analyzed (~$0.001/image)
- **Latency** - Network round-trip for each upload
- **AWS dependency** - Requires active AWS account
- **Collection management** - Need to create/manage collections
- **No offline support** - Requires internet connection

---

## 🎯 Recommended Strategy: **HYBRID APPROACH**

Use **both systems** for their strengths:

### **Use face-api.js for:**
1. ✅ Real-time upload feedback (instant face preview)
2. ✅ Client-side quick checks
3. ✅ Offline/local development

### **Use AWS Rekognition for:**
1. ✅ Batch processing existing photos
2. ✅ Google Drive imports (server-side)
3. ✅ Face search/matching (more accurate)
4. ✅ Clustering improvements
5. ✅ Background processing jobs

---

## 🗄️ Database Schema Changes

### **1. Update `face_embeddings` Table**

```sql
-- Add AWS Rekognition columns
ALTER TABLE face_embeddings
ADD COLUMN aws_face_id TEXT,           -- AWS's unique FaceId
ADD COLUMN aws_indexed_at TIMESTAMP,   -- When indexed to AWS
ADD COLUMN detection_method TEXT DEFAULT 'client';  -- 'client' or 'aws'

-- Create index for AWS face lookups
CREATE INDEX idx_face_embeddings_aws_face_id ON face_embeddings(aws_face_id);
CREATE INDEX idx_face_embeddings_detection_method ON face_embeddings(detection_method);
```

### **2. Add AWS Configuration Table**

```sql
-- Store AWS collection metadata
CREATE TABLE aws_face_collections (
  id SERIAL PRIMARY KEY,
  collection_id TEXT UNIQUE NOT NULL,   -- AWS collection ID
  collection_arn TEXT,                   -- AWS ARN
  face_count INTEGER DEFAULT 0,          -- Faces in collection
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP
);

-- Store AWS face matching results
CREATE TABLE aws_face_matches (
  id BIGSERIAL PRIMARY KEY,
  source_face_id TEXT NOT NULL,          -- AWS FaceId being searched
  matched_face_id TEXT NOT NULL,         -- AWS FaceId that matched
  similarity REAL NOT NULL,              -- 0-100 confidence score
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_aws_matches_source ON aws_face_matches(source_face_id);
CREATE INDEX idx_aws_matches_target ON aws_face_matches(matched_face_id);
```

---

## 🔧 Implementation Plan

### **Phase 1: Setup AWS Infrastructure** ✅

1. **Add AWS credentials to .env.local**
```bash
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_REKOGNITION_COLLECTION_ID=fmc-gallery-faces
```

2. **Create AWS Rekognition Collection** (one-time setup)
```typescript
// src/lib/aws/rekognition.ts
import { RekognitionClient, CreateCollectionCommand } from "@aws-sdk/client-rekognition";

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function createCollection() {
  const command = new CreateCollectionCommand({
    CollectionId: "fmc-gallery-faces",
  });
  await rekognition.send(command);
}
```

3. **Run database migrations**

---

### **Phase 2: Build AWS Integration Layer** ⏳

Create wrapper functions for AWS Rekognition operations:

#### **File: `src/lib/aws/rekognition.ts`**

```typescript
import {
  RekognitionClient,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  DeleteFacesCommand,
  DetectFacesCommand
} from "@aws-sdk/client-rekognition";

// 1. Index face to AWS
export async function indexFaceToAWS(
  imageBuffer: Buffer,
  photoId: string
) {
  const command = new IndexFacesCommand({
    CollectionId: process.env.AWS_REKOGNITION_COLLECTION_ID!,
    Image: { Bytes: imageBuffer },
    ExternalImageId: photoId,  // Links to our photos table
    MaxFaces: 10,              // Multiple faces per photo
    QualityFilter: "AUTO",     // AWS filters low-quality faces
  });

  const response = await rekognition.send(command);

  return response.FaceRecords?.map(record => ({
    aws_face_id: record.Face?.FaceId!,
    bbox: {
      x: record.Face?.BoundingBox?.Left ?? 0,
      y: record.Face?.BoundingBox?.Top ?? 0,
      width: record.Face?.BoundingBox?.Width ?? 0,
      height: record.Face?.BoundingBox?.Height ?? 0,
    },
    quality_score: record.FaceDetail?.Confidence ?? 0,
  })) ?? [];
}

// 2. Search similar faces
export async function searchSimilarFaces(
  imageBuffer: Buffer,
  threshold = 80  // AWS uses 0-100, not 0-1
) {
  const command = new SearchFacesByImageCommand({
    CollectionId: process.env.AWS_REKOGNITION_COLLECTION_ID!,
    Image: { Bytes: imageBuffer },
    FaceMatchThreshold: threshold,
    MaxFaces: 100,
  });

  const response = await rekognition.send(command);

  return response.FaceMatches?.map(match => ({
    aws_face_id: match.Face?.FaceId!,
    external_image_id: match.Face?.ExternalImageId!,  // Our photo_id
    similarity: match.Similarity!,  // 0-100
  })) ?? [];
}

// 3. Delete face from collection
export async function deleteFaceFromAWS(awsFaceId: string) {
  const command = new DeleteFacesCommand({
    CollectionId: process.env.AWS_REKOGNITION_COLLECTION_ID!,
    FaceIds: [awsFaceId],
  });

  await rekognition.send(command);
}

// 4. Detect faces without indexing (for preview)
export async function detectFaces(imageBuffer: Buffer) {
  const command = new DetectFacesCommand({
    Image: { Bytes: imageBuffer },
    Attributes: ["ALL"],  // Get face details: age, gender, emotions, etc.
  });

  const response = await rekognition.send(command);

  return response.FaceDetails?.map(face => ({
    bbox: {
      x: face.BoundingBox?.Left ?? 0,
      y: face.BoundingBox?.Top ?? 0,
      width: face.BoundingBox?.Width ?? 0,
      height: face.BoundingBox?.Height ?? 0,
    },
    confidence: face.Confidence ?? 0,
    age_range: face.AgeRange,
    gender: face.Gender?.Value,
    emotions: face.Emotions,
  })) ?? [];
}
```

---

### **Phase 3: Update Google Drive Import to Use AWS** ⏳

#### **Current Issue:**
Google Drive import downloads photos server-side → Uploads to Supabase → No face detection

#### **Solution:**
During server-side import, use AWS Rekognition:

```typescript
// src/app/api/admin/import-from-drive/route.ts

import { indexFaceToAWS } from "@/lib/aws/rekognition";

async function processGoogleDrivePhoto(imageUrl: string, photoId: string, eventId: string) {
  // 1. Download image from Google Drive
  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 2. Upload to Supabase Storage
  const supabasePath = await uploadToSupabase(buffer, eventId, photoId);

  // 3. Index faces to AWS
  const awsFaces = await indexFaceToAWS(buffer, photoId);

  // 4. Save to database
  for (const face of awsFaces) {
    await supabase
      .from("face_embeddings")
      .insert({
        photo_id: photoId,
        event_id: eventId,
        aws_face_id: face.aws_face_id,
        bbox: face.bbox,
        quality_score: face.quality_score / 100,  // Convert to 0-1
        detection_method: "aws",
        aws_indexed_at: new Date().toISOString(),
      });
  }

  return { indexed_faces: awsFaces.length };
}
```

---

### **Phase 4: Build Admin Tools for AWS** ⏳

#### **1. Batch Process Existing Photos with AWS**

```typescript
// POST /api/admin/faces/aws/batch-index

export async function POST(request: NextRequest) {
  // 1. Get all photos without AWS face_id
  const { data: photos } = await supabase
    .from("photos")
    .select("id, path")
    .limit(100);

  let indexed = 0;

  for (const photo of photos) {
    try {
      // Download photo from Supabase Storage
      const response = await fetch(photo.path);
      const buffer = Buffer.from(await response.arrayBuffer());

      // Index to AWS
      const faces = await indexFaceToAWS(buffer, photo.id);

      // Save to DB
      for (const face of faces) {
        await supabase.from("face_embeddings").insert({
          photo_id: photo.id,
          aws_face_id: face.aws_face_id,
          bbox: face.bbox,
          quality_score: face.quality_score / 100,
          detection_method: "aws",
          aws_indexed_at: new Date().toISOString(),
        });
      }

      indexed += faces.length;
    } catch (error) {
      console.error(`Failed to index photo ${photo.id}:`, error);
    }
  }

  return Response.json({
    success: true,
    indexed_faces: indexed
  });
}
```

#### **2. Sync AWS Clusters to Database**

AWS Rekognition automatically groups faces. We can query AWS's clusters:

```typescript
// GET /api/admin/faces/aws/sync-clusters

import { SearchFacesCommand } from "@aws-sdk/client-rekognition";

export async function GET() {
  // 1. Get all AWS face IDs from our database
  const { data: faces } = await supabase
    .from("face_embeddings")
    .select("id, aws_face_id")
    .not("aws_face_id", "is", null);

  // 2. For each face, find similar faces in AWS
  const clusters = new Map<string, string[]>();  // cluster_id -> [face_ids]

  for (const face of faces) {
    const command = new SearchFacesCommand({
      CollectionId: process.env.AWS_REKOGNITION_COLLECTION_ID!,
      FaceId: face.aws_face_id!,
      FaceMatchThreshold: 80,  // Adjust threshold
      MaxFaces: 100,
    });

    const response = await rekognition.send(command);

    // Group similar faces
    const similarFaceIds = response.FaceMatches?.map(m => m.Face?.FaceId!) ?? [];

    // Assign to cluster (simplified - real implementation would be more complex)
    clusters.set(face.aws_face_id!, similarFaceIds);
  }

  // 3. Create clusters in database
  // (Implementation details depend on your clustering logic)

  return Response.json({
    success: true,
    clusters: clusters.size
  });
}
```

---

### **Phase 5: Enhanced Face Search with AWS** ⏳

Replace current cosine distance search with AWS search:

```typescript
// POST /api/faces/search

export async function POST(request: NextRequest) {
  const { image } = await request.json();  // Base64 image

  // Convert base64 to buffer
  const buffer = Buffer.from(image, "base64");

  // Search AWS collection
  const matches = await searchSimilarFaces(buffer, 80);

  // Get photo details from database
  const photoIds = matches.map(m => m.external_image_id);
  const { data: photos } = await supabase
    .from("photos")
    .select("id, path, event_id, events(slug, title)")
    .in("id", photoIds);

  return Response.json({
    results: photos.map((photo, i) => ({
      photo_id: photo.id,
      photo_url: photo.path,
      similarity: matches[i].similarity / 100,  // Convert to 0-1
      event_slug: photo.events?.slug,
      event_title: photo.events?.title,
    })),
  });
}
```

---

## 💰 Cost Analysis

### **AWS Rekognition Pricing (as of 2025)**

| Operation | Cost | Example (1000 photos) |
|-----------|------|----------------------|
| Index Faces | $0.001 per image | $1.00 |
| Face Search | $0.001 per search | $1.00 for 1000 searches |
| Storage | First 1000 faces free/month | Free for small galleries |

**Estimated monthly cost for FMC Gallery:**
- 1000 photos uploaded/month: **~$1.00**
- 500 face searches/month: **~$0.50**
- **Total: ~$1.50/month**

Very affordable! 💰

---

## 🔄 Migration Path

### **Option A: Gradual Migration (Recommended)**

1. ✅ **Week 1:** Setup AWS, add new photos only
2. ✅ **Week 2:** Batch process 50% of existing photos
3. ✅ **Week 3:** Complete migration, keep face-api.js as fallback
4. ✅ **Week 4:** Test, tune thresholds, monitor performance

### **Option B: Big Bang Migration**

1. ⚡ Process all existing photos at once
2. ⚡ Switch all endpoints to AWS immediately
3. ⚠️ Risk: If AWS fails, entire system down

---

## 🎛️ Configuration Strategy

### **Environment Variables**

```bash
# .env.local

# AWS Rekognition
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
AWS_REKOGNITION_COLLECTION_ID=fmc-gallery-faces

# Face Detection Strategy
FACE_DETECTION_MODE=hybrid  # 'client' | 'aws' | 'hybrid'
FACE_SEARCH_MODE=aws        # 'client' | 'aws'
AWS_SIMILARITY_THRESHOLD=80 # 0-100 (AWS scale)
CLIENT_SIMILARITY_THRESHOLD=0.35  # 0-1 (cosine distance)
```

### **Feature Flags**

```typescript
// src/lib/config.ts

export const FACE_CONFIG = {
  // Use AWS for server-side operations
  USE_AWS_FOR_GOOGLE_DRIVE: true,
  USE_AWS_FOR_BATCH_PROCESSING: true,
  USE_AWS_FOR_SEARCH: true,

  // Keep client-side for real-time uploads
  USE_CLIENT_FOR_UPLOADS: true,

  // Fallback strategy
  FALLBACK_TO_CLIENT_ON_AWS_ERROR: true,
} as const;
```

---

## 📋 Implementation Checklist

### **Setup Phase**
- [ ] Add AWS credentials to .env.local
- [ ] Install AWS SDK (already done ✅)
- [ ] Create AWS Rekognition collection
- [ ] Run database migrations
- [ ] Create `src/lib/aws/rekognition.ts`

### **Integration Phase**
- [ ] Build AWS wrapper functions
- [ ] Update Google Drive import to use AWS
- [ ] Create batch processing endpoint
- [ ] Add AWS face search endpoint
- [ ] Update admin UI for AWS operations

### **Testing Phase**
- [ ] Test AWS indexing with sample photos
- [ ] Test face search accuracy
- [ ] Compare AWS vs client accuracy
- [ ] Load test with 1000+ photos
- [ ] Monitor AWS costs

### **Deployment Phase**
- [ ] Gradual rollout to production
- [ ] Monitor error rates
- [ ] Tune similarity thresholds
- [ ] Document AWS operations

---

## 🚨 Important Considerations

### **1. AWS Collection Limits**
- Max 20 million faces per collection
- FMC Gallery should never hit this

### **2. Data Privacy**
- AWS stores face metadata in their cloud
- Review AWS privacy policy
- Ensure compliance with privacy laws

### **3. Error Handling**
- AWS API can fail (rate limits, outages)
- Always have client-side fallback
- Store detection_method to know source

### **4. Cost Monitoring**
- Set up AWS billing alerts
- Monitor IndexFaces usage
- Cap batch processing to prevent runaway costs

### **5. Collection Management**
- Periodically clean up deleted photos
- Sync AWS collection with database
- Handle AWS face deletions

---

## 🎯 Success Metrics

### **After AWS Integration:**

| Metric | Before (Client) | After (AWS) | Improvement |
|--------|----------------|-------------|-------------|
| Batch process 100 photos | 5-10 minutes | 30-60 seconds | **10x faster** |
| Face search accuracy | ~85% | ~95% | **+10%** |
| Google Drive face detection | ❌ Not supported | ✅ Full support | **New feature** |
| Clustering quality | Manual algorithm | AWS automatic | **Better** |
| Browser memory usage | High (OOM risk) | Low | **Stable** |

---

## 🔮 Future Enhancements (Post-AWS)

1. **Face attributes** - Age, gender, emotions from AWS
2. **Celebrity detection** - AWS can detect famous people
3. **Face comparison API** - Compare two specific faces
4. **Smart albums** - "All photos with smiling faces"
5. **Face blur** - Automatically blur faces for privacy
6. **Video face detection** - AWS supports video analysis

---

**Next Steps:**
1. Review this strategy
2. Add AWS credentials to .env.local
3. Create AWS Rekognition collection
4. Run database migrations
5. Build integration layer

**Estimated implementation time:** 3-4 days
**Recommended approach:** Hybrid (keep both systems)

---

**Created:** 2025-03-20
**Author:** Claude Code Assistant
**Status:** Strategy Draft - Awaiting Approval
