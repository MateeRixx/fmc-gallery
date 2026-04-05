# Remaining Work Items for FMC Gallery

## 🔴 CRITICAL - Must Fix for Production

### 1. **Cleanup Old Auth Files (7 Files)**
**Priority: HIGH** - Remove deprecated code
- `src/app/api/auth/route.ts` - Old JWT login endpoint
- `src/app/api/auth/verify-otp/route.ts` - Old OTP verification
- `src/app/api/auth/resend-otp/route.ts` - Old OTP resend
- `src/lib/jwt.ts` - JWT creation/storage (replaced by NextAuth)
- `src/lib/otp.ts` - OTP utilities (replaced by NextAuth email)
- `src/lib/middleware.ts` - Old auth middleware (replaced by auth-utils)
- `src/components/auth/OTPVerificationForm.tsx` - Old OTP form component

**Status**: Identified in `PHASE_6_CLEANUP_CHECKLIST.md` - Ready to delete

---

### 2. **Migrate Admin Routes from Old Middleware (13 Routes)**
**Priority: HIGH** - All admin routes still use old middleware

#### Routes to Migrate:
- `src/app/api/admin/events/route.ts` - POST, PUT (create/update events)
- `src/app/api/admin/events/check-slug/route.ts`
- `src/app/api/admin/photos/route.ts` - POST (add photos)
- `src/app/api/admin/users/route.ts` - GET (list users)
- `src/app/api/admin/users/[id]/route.ts` - GET, PUT, DELETE
- `src/app/api/admin/users/[id]/permissions/route.ts` - PATCH
- `src/app/api/admin/users/[id]/deactivate/route.ts` - POST
- `src/app/api/admin/faces/index/route.ts`
- `src/app/api/admin/faces/index-aws/route.ts`
- `src/app/api/admin/faces/unprocessed/route.ts`
- `src/app/api/admin/faces/stats/route.ts`
- `src/app/api/admin/faces/test/route.ts`
- `src/app/api/admin/invitations/route.ts` - POST

#### Current Issue:
```typescript
// ❌ OLD (still using)
import { requirePermission } from "@/lib/middleware";
const user = await requirePermission(request, Permission.CAN_UPLOAD_PHOTOS);
if (user instanceof Response) return user;
```

#### Update To:
```typescript
// ✅ NEW (should use)
import { requirePermission } from "@/lib/auth-utils";
const user = await requirePermission("canUploadPhotos");
```

**Pattern**: Replace old middleware with new auth-utils wrapper functions

---

### 3. **Update Admin/Navbar Components (2 Components)**
**Priority: HIGH** - Using old JWT localStorage functions

#### Files:
- `src/components/Navbar.tsx` - Uses `getCurrentUser()`, `clearToken()`
- `src/app/admin/AdminContent.tsx` - Uses `getCurrentUser()`, `clearToken()`

#### Current Issue:
```typescript
// ❌ OLD
import { getCurrentUser, clearToken } from "@/lib/jwt";
const user = getCurrentUser();
const handleLogout = () => clearToken();
```

#### Update To:
```typescript
// ✅ NEW
import { useSession, signOut } from "next-auth/react";
const { data: session } = useSession();
const handleLogout = async () => {
  await signOut({ redirect: true, callbackUrl: '/login' });
};
```

---

### 4. **Add Cache Revalidation to Event Mutations (3 Routes)**
**Priority: MEDIUM** - Pages cache but mutations don't invalidate

#### Routes:
- `POST /api/admin/events` - Add cache revalidation after create
- `PUT /api/admin/events` - Add cache revalidation after update
- `DELETE /api/admin/events/[id]` - Add cache revalidation after delete

#### Pattern:
```typescript
import { revalidateEvent } from "@/lib/cache";

// After successful mutation:
await revalidateEvent(eventId, eventSlug);
```

---

## 🟡 MEDIUM PRIORITY - Should Fix

### 5. **Update Admin Invitations Endpoint**
**File**: `src/app/api/auth/create-invitation/route.ts`
- Uses old middleware: `requireRole("head")`
- Should use: `requireRole("head")` from auth-utils

### 6. **Remove Documentation Clutter**
**Files to consider deleting**:
- `CLUSTERING_REDESIGN_PLAN.md`
- `GOOGLE_LOGIN_UI_GUIDE.md`
- `GOOGLE_OAUTH_SETUP.md`
- `GOOGLE_OAUTH_UI_MINIMAL.md`
- `OAUTH_IMPLEMENTATION_SUMMARY.md`
- `PERSONALIZED_FACE_SEARCH_DESIGN.md`
- `TESTING_PHASE_1_2.md`
- Various docs in `/docs` folder

---

## 🟢 NICE TO HAVE - Polish

### 7. **Test End-to-End Flows**
- Signup flow: Email → Magic link → Dashboard
- Signin flow: Email → Magic link → Dashboard
- Admin routes: Verify permission checks work
- Face clustering: Verify pagination works
- Event caching: Verify ISR triggers on mutations

### 8. **Update TypeScript Types**
- Ensure `src/lib/auth.ts` session types match all code usage
- Update type definitions for NextAuth session

### 9. **Performance Optimizations**
- Verify image optimization on face thumbnails
- Check bundle size impact of new dependencies
- Monitor ISR cache hit rates

---

## Summary Table

| Task | Files Affected | Priority | Est. Time |
|------|---|---|---|
| Delete old auth files | 7 files | HIGH | 5 min |
| Migrate admin routes | 13 files | HIGH | 30 min |
| Update components | 2 files | HIGH | 15 min |
| Add cache revalidation | 3 routes | MEDIUM | 10 min |
| Update invitations | 1 file | MEDIUM | 5 min |
| Cleanup docs | 8 files | MEDIUM | 10 min |
| **Total** | **34 files** | **HIGH** | **~75 min** |

---

## Recommended Order of Work

1. ✅ **Delete old auth files** (5 min)
   - Remove 7 files that no longer exist
   - Run `npm run build` to verify

2. 🔧 **Migrate admin routes** (30 min)
   - Update imports: `middleware` → `auth-utils`
   - Update function calls (see pattern above)
   - Test endpoints with proper auth

3. 🔧 **Update components** (15 min)
   - Navbar: Switch to `useSession()` + `signOut()`
   - AdminContent: Same changes
   - Test navbar login/logout

4. ✏️ **Add cache revalidation** (10 min)
   - Integrate `revalidateEvent()` into event mutations
   - Test that pages refresh after edits

5. 🧹 **Cleanup docs** (10 min)
   - Delete guide files
   - Keep `PHASE_6_CLEANUP_CHECKLIST.md` for reference

6. 🧪 **End-to-end testing** (Varies)
   - Test all critical flows
   - Verify admin endpoints require auth

---

## Quick Reference: Old → New Mapping

| Old | Location | New | Location |
|-----|----------|-----|----------|
| `getCurrentUser()` | ❌ `jwt.ts` | `useSession()` | ✅ NextAuth |
| `clearToken()` | ❌ `jwt.ts` | `signOut()` | ✅ NextAuth |
| `createJWT()` | ❌ `jwt.ts` | NextAuth JWT | ✅ `auth.ts` |
| `requirePermission()` | ❌ `middleware.ts` | `requirePermission()` | ✅ `auth-utils.ts` |
| `requireAuth()` | ❌ `middleware.ts` | `requireAuth()` | ✅ `auth-utils.ts` |
| `requireRole()` | ❌ `middleware.ts` | `requireRole()` | ✅ `auth-utils.ts` |
| OTP flow | ❌ `otp.ts` | Email magic link | ✅ NextAuth |

---

## Build Status

Current: ✅ **Compiles successfully**
After cleanup: ✅ **Should compile without warnings**

Run after each step:
```bash
npm run build
```
