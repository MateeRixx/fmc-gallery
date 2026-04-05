# Testing Plan for Authentication System Overhaul

## Phase 1 & 2 Testing Checklist

### ✅ 1. LOCAL SETUP & COMPILATION

**Step 1.1: Install Dependencies**
```bash
cd c:/D-Drive/Projects/FMC-Gallery/fmc-gallery
npm install
```
Expected: Resend package installed ✓

**Step 1.2: Check TypeScript Compilation**
```bash
npm run type-check
# or
npm run build
```
Expected: Zero type errors in:
- `src/lib/otp.ts`
- `src/lib/roleDefaults.ts`

**Step 1.3: Verify Imports**
The following should resolve without errors:
- `import { Resend } from "resend"`
- `import { createClient } from "@supabase/supabase-js"`
- `import crypto from "crypto"`

---

### ✅ 2. DATABASE MIGRATIONS

**Step 2.1: Check Migration Files**
```bash
ls -la supabase/migrations/20260318_*
```
Expected output:
```
✓ 20260318_create_invitations_table.sql
✓ 20260318_create_otp_codes_table.sql
✓ 20260318_add_legend_tracking_to_users.sql
✓ 20260318_create_role_defaults.sql
```

**Step 2.2: Apply Migrations to Supabase**
1. Go to: https://supabase.com/dashboard/project/_/sql
2. Copy content of each migration file
3. Execute them in order
4. Verify tables are created:
   - `invitations` table
   - `otp_codes` table
   - `role_default_permissions` table
   - `users` table updated with new columns

**Step 2.3: Verify Role Defaults Inserted**
In Supabase SQL editor:
```sql
SELECT * FROM role_default_permissions;
```
Expected: 4 rows (head, co_head, executive, member) with permissions

---

### ✅ 3. ENVIRONMENT SETUP

**Step 3.1: Create .env.local**
```bash
cp .env.example .env.local
```

**Step 3.2: Get Resend API Key**
1. Go to https://resend.com
2. Create account (free tier available)
3. Get API key from dashboard
4. Add to .env.local:
```
RESEND_API_KEY=re_your_actual_key_here
```

**Step 3.3: Verify Email Sender**
In Resend dashboard:
1. Add sender email (e.g., noreply@yourdomain.com)
2. Verify ownership
3. Add to .env.local:
```
EMAIL_FROM=noreply@yourdomain.com
```

**Step 3.4: Complete .env.local**
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=re_your_key
EMAIL_FROM=noreply@yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=your_secret_key
JWT_EXPIRY_DAYS=30
```

---

### ✅ 4. OTP FUNCTIONS TESTING

**Step 4.1: Test OTP Generation**
```typescript
// Open Next.js terminal or Node REPL
import { generateOTP, generateInvitationToken } from "@/lib/otp";

// Test OTP
const otp = generateOTP();
console.log(otp); // Should print 6-digit number like: 123456

// Test Invitation Token
const token = generateInvitationToken();
console.log(token); // Should print 48-char hex string
```

**Step 4.2: Test Email Sending (Skip for now)**
- Will test with API endpoints in Phase 3
- Requires Supabase setup with OTP records

**Step 4.3: Verify Function Exports**
```bash
npm run build
```
Expected: No errors, all functions compile correctly

---

### ✅ 5. ROLE DEFAULTS TESTING

**Step 5.1: Test Role Permissions**
```typescript
import { getDefaultPermissionsForRole, canInviteRole } from "@/lib/roleDefaults";
import { UserRole } from "@/types";

// Test getting permissions
const headPerms = getDefaultPermissionsForRole(UserRole.HEAD);
console.log(headPerms); // Should have 9 permissions

const execPerms = getDefaultPermissionsForRole(UserRole.EXECUTIVE);
console.log(execPerms); // Should have 5 permissions

const memberPerms = getDefaultPermissionsForRole(UserRole.MEMBER);
console.log(memberPerms); // Should be empty array []
```

**Step 5.2: Test Invite Hierarchy**
```typescript
import { canInviteRole } from "@/lib/roleDefaults";

// Test what roles can invite what
console.log(canInviteRole(UserRole.HEAD, UserRole.HEAD)); // true
console.log(canInviteRole(UserRole.HEAD, UserRole.CO_HEAD)); // true
console.log(canInviteRole(UserRole.CO_HEAD, UserRole.HEAD)); // false
console.log(canInviteRole(UserRole.EXECUTIVE, UserRole.MEMBER)); // false
```

---

### ✅ 6. INTEGRATION CHECK

**Step 6.1: Verify All Imports Work**
Create a test file to verify all imports:
```typescript
// test-imports.ts
import {
  generateOTP,
  generateInvitationToken,
  sendOTPEmail,
  sendInvitationEmail,
  validateAndCreateUser,
  storeOTP,
  createAndSendInvitation,
  validateInvitationToken,
  incrementOTPAttempts
} from "@/lib/otp";

import {
  roleDefaultPermissions,
  getDefaultPermissionsForRole,
  roleInviteHierarchy,
  canInviteRole,
  roleDisplayNames,
  roleDescriptions
} from "@/lib/roleDefaults";

console.log("✓ All OTP functions imported");
console.log("✓ All roleDefaults functions imported");
```

**Step 6.2: Run Type Check**
```bash
npm run type-check
```
Expected: Zero errors

---

### ✅ 7. DEV SERVER TEST

**Step 7.1: Start Development Server**
```bash
npm run dev
```
Expected:
- No TypeScript errors
- App runs on http://localhost:3000
- No console errors related to missing modules

**Step 7.2: Test Navigation**
- Visit home page ✓
- Click "LOGIN" → should see login page ✓
- Can navigate back to home ✓

---

## Summary Checklist

- [ ] npm install completed without errors
- [ ] TypeScript type-check passes
- [ ] All 4 migration files created
- [ ] Migrations applied to Supabase
- [ ] role_default_permissions table populated
- [ ] .env.local created with all keys
- [ ] Resend API key obtained and added
- [ ] Email sender verified in Resend
- [ ] All OTP functions compile correctly
- [ ] All roleDefaults functions compile correctly
- [ ] Dev server starts without errors
- [ ] No TypeScript errors on build

## Ready for Phase 3?

Once all ✓ checks pass, we can proceed to:
**Phase 3: Backend API Endpoints**
- POST /api/auth/register
- POST /api/auth/verify-otp
- POST /api/auth/create-invitation
- POST /api/admin/users/[id]/upgrade-role
- POST /api/legends

---

## Troubleshooting

### Issue: "Cannot find module 'resend'"
**Solution:**
```bash
npm install resend
```

### Issue: TypeScript errors in otp.ts
**Solution:** Ensure Supabase types are installed:
```bash
npm install @supabase/supabase-js
```

### Issue: Resend email not sending
**Solution:**
1. Verify API key in .env.local
2. Verify email sender is verified in Resend dashboard
3. Check Resend logs for errors

### Issue: DATABASE migrations fail
**Solution:**
1. Ensure service_role_key has correct permissions
2. Check for constraint violations
3. Run migrations one at a time to isolate errors

---

**Questions? Check the plan file at:** `C:\Users\mohit\.claude\plans\sunny-nibbling-gosling.md`
