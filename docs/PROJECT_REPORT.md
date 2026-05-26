# FMC-Gallery: Comprehensive Project Report & Interview Guide

## 1. Project Overview
**FMC-Gallery** is a modern, full-stack event photo management platform designed to host, organize, and smartly navigate large collections of event photos. Beyond a standard gallery, the application incorporates advanced AI features such as **Face Recognition & Clustering**, allowing users to find all photos of themselves across various events. It features a robust Role-Based Access Control (RBAC) system for administrators and a highly optimized image delivery pipeline.

## 2. Tech Stack
*   **Frontend**: React, Next.js (App Router), Tailwind CSS.
*   **Backend**: Next.js API Routes (Serverless).
*   **Database**: Supabase (PostgreSQL) with `pgvector` for AI embeddings.
*   **Storage**: Supabase Storage (Buckets: `event-images`, `gallery`, `profile-photos`).
*   **Authentication**: NextAuth.js combined with Supabase Auth, utilizing passwordless OTP (Email-based via Resend).
*   **AI/ML**: AWS Rekognition / Face-API for face detection, embedding generation, and clustering.
*   **Image Processing**: Client-side compression (browser-image-compression) and server-side processing (`sharp`)

## 3. Core Features & System Design
e
### A. Role-Based Access Control (RBAC)
*   **Roles**: Supreme Admin (Master/Head/Co-Head), Admins, Members, and Visitors.
*   **Implementation**: NextAuth custom callbacks inject the user's role and permissions directly into the JWT token. 
*   **Security**: API routes validate permissions (e.g., `CAN_UPLOAD_PHOTOS`, `CAN_DELETE_PHOTOS`) before executing sensitive operations (e.g., deleting from buckets).

### B. AI-Powered Face Recognition
*   **Workflow**: 
    1. When a photo is uploaded, it is sent to a background job (`/api/admin/faces/index-aws`).
    2. The AI model detects faces, generates vector embeddings, and stores them in Supabase (using PostgreSQL's `pgvector` extension).
    3. When a user uploads a "profile photo" of themselves, the system extracts its vector and performs a similarity search query against the database to fetch all matching photos.

### C. Optimized Asset Management 
*   **Uploads**: Photos are compressed client-side (max 1920px, ~1.5MB) to save bandwidth, then processed server-side using `sharp` before being placed in Supabase Storage.
*   **Deletions**: Handled via cascading logic. Deleting a photo also removes its corresponding face embeddings from the database and physically deletes the object from the respective Supabase Storage bucket.

## 4. Key Technical Challenges & Solutions (Interview Focus)

### Challenge 1: Managing Large-Scale Photo Deletions & Next.js Caching
**The Problem**: When admins deleted photos, Next.js's aggressive caching served stale gallery pages. Furthermore, photos uploaded to legacy buckets (e.g., `gallery` vs `event-images`) or paths containing URL-encoded characters (like `%20` for spaces) were failing silent deletion in storage.
**The Solution**:
*   Wrote dynamic bucket resolution logic that extracts the correct destination bucket and decodes URI components dynamically based on the image's URL prefix.
*   Replaced soft-deletes with explicit `revalidatePath('/events/[slug]', 'page')` commands in the Next.js API router to forcefully bust the App Router's cache immediately after database execution.

### Challenge 2: Image Upload Memory Spikes
**The Problem**: Uploading hundreds of high-res images from modern cameras caused browser tabs to crash due to out-of-memory (OOM) errors.
**The Solution**:
*   Implemented client-side image compression using web workers before data leaves the device.
*   Transformed the upload loop into a chunked array processor, which uploads images sequentially in batches (Save Chunks) and triggers background AWS indexing in parts to prevent server timeouts.

### Challenge 3: Secure Session Management
**The Problem**: Users remained logged in indefinitely, causing potential privacy concerns on shared devices.
**The Solution**: 
*   Transitioned the NextAuth JWT strategy to enforce strict TTLs (Time-to-Live). Modified the session `maxAge` from 30 days to 4 hours, forcing token expiry and automatic user logout.

## 5. Potential Interview Questions & Answers

**Q: Why did you choose Supabase over a standard Node.js/Express + MongoDB backend?**
*Answer*: Supabase provides a full PostgreSQL database out-of-the-box, allowing us to utilize the `pgvector` extension for face recognition embeddings natively. It also drastically reduced boilerplate by providing built-in Storage buckets and Row Level Security (RLS), letting us focus heavily on the complex Next.js frontend and AI logic.

**Q: How does the Face Search feature work under the hood?**
*Answer*: We process images to detect faces and convert them into numerical vectors (embeddings). When a user searches for themselves, we convert their selfie into a vector and execute a `pgvector` cosine similarity search (e.g., `<->` operator in Postgres) to find embeddings that mathematically sit close to the search vector.

**Q: How did you structure your authentication?**
*Answer*: We used NextAuth with a Custom Credentials provider. We do passwordless authentication where users receive an OTP via email (Resend API). Once verified, Supabase returns the User ID, and NextAuth mints an encrypted JWT containing their RBAC roles/permissions, keeping subsequent API requests exceptionally fast without hitting the database on every route.

**Q: How do you handle Next.js App Router Caching?**
*Answer*: Next.js caches fetch requests and pages aggressively. For our photo gallery, we leverage `revalidatePath` inside our Server Actions and API route handlers when state changes (like uploading or deleting a photo). This ensures visitors receive instant UI updates while maintaining static-like generation performance in the interim.
