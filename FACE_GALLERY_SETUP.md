# Face Gallery Setup & Usage Guide

## ✅ What I Fixed

1. **Created Database Migration** - `supabase/migrations/20260319_create_face_tables.sql`
   - `face_embeddings` table for storing detected faces
   - `face_clusters` table for person groupings
   - `search_similar_faces()` SQL function for similarity search
   - Row-level security policies

2. **Downloaded Face-API Models** - All models are now in `public/models/face-api/`
   - tiny_face_detector_model (189KB)
   - face_landmark_68_model (349KB)
   - face_recognition_model (6.2MB)

3. **Added Tool to Process Existing Photos** - New section in `/admin/faces`
   - Fetches photos without face embeddings
   - Runs face detection client-side in your browser
   - Automatically indexes faces and runs reclustering

## 🚀 Setup Instructions

### Step 1: Run the Database Migration

**Open your Supabase dashboard:**
1. Go to your Supabase project: https://supabase.com/dashboard
2. Click on **SQL Editor** in the left sidebar
3. Open the file: `supabase/migrations/20260319_create_face_tables.sql`
4. Copy all contents and paste into the SQL Editor
5. Click **Run** to execute

This creates:
- `face_embeddings` table
- `face_clusters` table
- `search_similar_faces()` function

### Step 2: Process Existing Photos (if you have any)

1. Start your dev server: `npm run dev`
2. Log in as Master/Admin (summohith@gmail.com)
3. Navigate to: `http://localhost:3000/admin/faces`
4. Click **"Process Unprocessed Photos"** button
5. Wait for processing to complete (may take a few minutes for many photos)

### Step 3: View Your People Gallery

Visit: `http://localhost:3000/people`

You should now see automatically grouped faces!

## 📖 How It Works

### Automatic Face Detection (New Uploads)
- When you upload photos via the "+" button, face detection runs automatically
- Face embeddings are extracted and saved to `face_embeddings` table
- Clustering happens incrementally

### Manual Reclustering
- Visit `/admin/faces`
- Adjust threshold (lower = stricter matching, higher = looser)
- Click "Run Full Reclustering" to rebuild all person groups

### People Gallery
- `/people` - View all detected people as clusters
- `/people/[id]` - View all photos of a specific person
- Click on any person to see their photos across all events

## 🔧 Troubleshooting

**"No people clusters yet"**
→ Run face detection on existing photos from `/admin/faces`

**Face detection not working during upload**
→ Check browser console for errors
→ Ensure models loaded (check Network tab for `/models/face-api/` requests)

**Poor clustering (same person split into multiple groups)**
→ Increase threshold (try 0.40-0.45)
→ Run reclustering from admin panel

**Too many different people grouped together**
→ Decrease threshold (try 0.30-0.35)
→ Run reclustering from admin panel

## 🎯 Performance Tips

- Face detection runs in your browser (not server-side)
- Processing 100 photos takes ~5-10 minutes depending on your device
- Best results with clear, front-facing photos
- Low quality/blurry faces are filtered out (quality_score < 0.45)

## 🌐 API Endpoints Created

- `POST /api/admin/faces/index` - Index face embeddings
- `POST /api/admin/faces/recluster` - Rebuild person clusters
- `GET /api/admin/faces/unprocessed` - List photos without embeddings
- `POST /api/faces/search` - Search by face similarity
- `GET /api/faces/people` - List person clusters
- `GET /api/faces/people/[id]` - Get photos for a person

---

**Next step: Run the SQL migration in Supabase, then process your existing photos!**
