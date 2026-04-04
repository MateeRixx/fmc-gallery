# Phase 6: Old Auth System Cleanup Checklist

## Status: ✅ READY FOR DELETION

All old OTP/JWT auth files have been identified and are safe to delete. No components or routes currently use them.

---

## Files to Delete (Safe - No Dependencies)

### Old Auth Endpoints (DELETE THESE FILES)

1. **`src/app/api/auth/route.ts`**
   - Old JWT login endpoint
   - Replaced by: NextAuth email provider (`src/lib/auth.ts`)
   - No remaining imports or uses

2. **`src/app/api/auth/verify-otp/route.ts`**
   - Old OTP verification endpoint
   - Replaced by: NextAuth email callback
   - No remaining imports or uses

3. **`src/app/api/auth/resend-otp/route.ts`**
   - Old OTP resend endpoint
   - Replaced by: NextAuth email provider resend logic
   - No remaining imports or uses

### Old Utility Libraries (DELETE THESE FILES)

4. **`src/lib/jwt.ts`**
   - Old JWT creation/storage utilities
   - Replaced by: NextAuth HttpOnly cookies
   - No remaining imports found (verified with grep)

5. **`src/lib/otp.ts`**
   - OTP generation, storage, email sending
   - Replaced by: NextAuth email provider with Resend API
   - No remaining imports found (verified with grep)

6. **`src/lib/middleware.ts`**
   - Old route middleware (`requireAuth`, `requireRole`)
   - Replaced by: `src/lib/auth-utils.ts` (new implementation)
   - No remaining imports found (verified with grep)

### Old Components (DELETE THESE FILES)

7. **`src/components/auth/OTPVerificationForm.tsx`**
   - Old OTP input form component
   - Replaced by: NextAuth email magic link flow (no component needed)
   - Not imported anywhere (verified with grep)

---

## Updated Files (Already Done)

✅ **`src/app/api/auth/register/route.ts`**
- Removed OTP imports (`generateOTP`, `storeOTP`, `sendOTPEmail`)
- Now just creates user account in database
- NextAuth email provider handles magic link sending
- Still rate-limited (20 req/min)
- Still validates invitations for Head/Co-Head roles

---

## Verification Steps (All Passed ✅)

- ✅ No components import from `jwt.ts`
- ✅ No components import from `otp.ts`
- ✅ No components import from `middleware.ts`
- ✅ No components call `/api/auth/verify-otp`
- ✅ No components call `/api/auth/resend-otp`
- ✅ OTPVerificationForm not imported anywhere
- ✅ Build passes without these files in imports
- ✅ All NextAuth migration completed

---

## How to Complete Cleanup

**Option 1: Manual Deletion**
Delete the 7 files listed above from your file system

**Option 2: Using Git**
```bash
# Remove these files from git
git rm src/app/api/auth/route.ts
git rm src/app/api/auth/verify-otp
git rm src/app/api/auth/resend-otp
git rm src/lib/jwt.ts
git rm src/lib/otp.ts
git rm src/lib/middleware.ts
git rm src/components/auth/OTPVerificationForm.tsx

# Commit the cleanup
git commit -m "chore: remove old OTP/JWT auth system (replaced by NextAuth)"
```

---

## After Deletion

Run `npm run build` to verify everything still works:
- All routes should compile
- No import errors
- No unused variable warnings

---

## Summary

**7 files can be safely deleted** - they're completely replaced by:
- NextAuth.js (email magic links + Google OAuth)
- `src/lib/auth-utils.ts` (new server-side auth helpers)
- `src/hooks/useAuth.ts` (new client-side auth hook)

All old code paths have been removed from the application.
