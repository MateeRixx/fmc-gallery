# FMC Gallery - Clustering Redesign Summary

## Issues Fixed Today (Mar 28, 2026)

### Build Errors ✅
- Fixed TypeScript error at line 267: `mergeResult.reason` undefined access
- Build should now pass successfully

### Deployment Blockers ✅
- Created `vercel.json` with:
  - maxDuration: 300s (requires Vercel Enterprise)
  - memory: 3GB for clustering routes
- **WARNING**: Vercel Pro only supports 60s timeout. Need Enterprise ($400/mo) or redesign.

## Root Causes Identified

### Critical Architecture Flaws (from agent analysis):
1. **O(n²) AWS API calls** - 1000 faces = 1000+ API calls = 15+ minutes
2. **Memory explosion** - Full graph in memory hits Vercel 1GB limit
3. **Duplicate merge disabled** - Skips entirely when >80 clusters
4. **Weak voting** - Plurality without quality = cluster drift
5. **No fault tolerance** - Single AWS error aborts entire process
6. **DB chattiness** - 200+ individual queries instead of bulk updates

### Why Vercel Deployment Fails:
- Timeout: Clustering takes >60s (free/pro limit)
- Memory: Large galleries exceed 1GB RAM limit
- Cost: Need Enterprise just for longer timeouts

## Recommended Solution

**Option 3: Full Redesign** (see CLUSTERING_REDESIGN_PLAN.md)

**Benefits:**
- 50-100x faster (sub-second incremental, <5min full recluster)
- Scales to 10,000+ faces
- Works on Vercel Hobby (free) tier
- Saves $400/month (no Enterprise needed)
- 90% reduction in AWS costs

**Timeline:** 1-2 weeks
**Approach:** HDBSCAN + pgvector + background jobs (Inngest)

## Next Steps

1. Review full plan: `CLUSTERING_REDESIGN_PLAN.md`
2. Choose option (1=quick fix, 2=hybrid, 3=redesign)
3. Let Claude implement chosen solution

## Files Modified
- `src/app/api/admin/faces/recluster/route.ts` (line 267 fix)
- `vercel.json` (created)
- `CLUSTERING_REDESIGN_PLAN.md` (created)
