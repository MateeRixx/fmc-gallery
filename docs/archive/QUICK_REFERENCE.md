# Quick Reference - OTP Authentication System

## File Structure

```
src/
├── lib/
│   ├── auth.ts                    # NextAuth config (updated)
│   ├── auth-utils.ts              # Auth middleware helpers (updated)
│   ├── email.ts                   # Email sending (new)
│   ├── otp-utils.ts               # OTP logic (new)
│   └── membership-utils.ts        # Role/membership logic (new)
├── app/api/
│   ├── auth/
│   │   ├── request-otp/route.ts  # POST: Generate OTP (new)
│   │   └── verify-otp/route.ts   # POST: Verify OTP & create user (new)
│   └── admin/
│       ├── members/route.ts       # GET: List members (new)
│       ├── members/[id]/
│       │   ├── promote/route.ts   # POST: Change role (new)
│       │   ├── deactivate/route.ts # POST: Deactivate (new)
│       │   └── transfer-head/route.ts # POST: Transfer HEAD (new)
│       └── invites/
│           └── send/route.ts      # POST: Send invite (new)
```

## Core Concepts

### Role Levels (0-3)
- **0 = VISITOR**: No membership, read-only
- **1 = EXECUTIVE**: Can create events, upload photos
- **2 = CO_HEAD**: Admin, manage members
- **3 = HEAD**: Full control, transfers role

### Authentication Flow
```
1. User submits email to /api/auth/request-otp
2. System generates 6-digit OTP, stores in DB, sends email
3. User submits OTP to /api/auth/verify-otp
4. System verifies OTP, creates/updates user, creates membership
5. Frontend calls signIn() with credentials provider
6. Session created with role levels
```

### Database Changes
- **New table**: `memberships` (user_id, role_level, is_active, dates)
- **Modified table**: `users` (role field now nullable)
- **Enhanced table**: `otp_codes` (added verified column, cleanup)

## Common Tasks

### Check User Role in API Route

```typescript
// Option 1: Using role level
import { requireRoleLevel, ROLE_LEVELS } from '@/lib/membership-utils';

await requireRoleLevel(ROLE_LEVELS.EXECUTIVE);  // Must be EXECUTIVE+

// Option 2: Using wrapper
import { withAuthExecutive } from '@/lib/auth-utils';
export const POST = withAuthExecutive()(async (req, user) => { ... });

// Option 3: Check manually
const user = await requireAuth();
const level = await getUserRoleLevel(user.id);
if (level < ROLE_LEVELS.CO_HEAD) throw new ForbiddenError(...);
```

### Get User's Current Role in Component

```typescript
import { useSession } from 'next-auth/react';

const { data: session } = useSession();

const isHead = session?.user.roleLevel === 3;
const isAdmin = session?.user.roleLevel >= 2;
const isExecutive = session?.user.roleLevel >= 1;
const isVisitor = session?.user.roleLevel === 0;
const isActive = session?.user.isActive;
```

### Protect a Next.js Page

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) redirect('/login');
  if (session.user.roleLevel < 2) redirect('/unauthorized');  // CO_HEAD+

  return <AdminContent />;
}
```

### Send Someone an Invite

```typescript
const response = await fetch('/api/admin/invites/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'newperson@example.com',
    role_level: 1,  // 0=VISITOR, 1=EXECUTIVE, 2=CO_HEAD, 3=HEAD
  }),
});
const { token, email_sent } = await response.json();
```

### Promote a Member

```typescript
const response = await fetch(`/api/admin/members/${userId}/promote`, {
  method: 'POST',
  body: JSON.stringify({ role_level: 2 }),  // Promote to CO_HEAD
});
```

### Deactivate a Member

```typescript
const response = await fetch(`/api/admin/members/${userId}/deactivate`, {
  method: 'POST',
});
// User stays in DB, but is_active = false
```

### Transfer HEAD Role

```typescript
// Only HEAD can do this
const response = await fetch(`/api/admin/members/${newHeadId}/transfer-head`, {
  method: 'POST',
});
// Current HEAD deactivated, new HEAD activated
```

## Environment Variables

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secret

# Email
RESEND_API_KEY=your-key
EMAIL_FROM=noreply@yoursite.com

# Bootstrap
FIRST_HEAD_EMAIL=admin@yoursite.com
```

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Invalid request (email, OTP format, etc.) |
| 401 | Not authenticated |
| 403 | Forbidden (role too low, not your membership) |
| 409 | Conflict (user already exists) |
| 429 | Rate limited |
| 500 | Server error |

## Important Notes

1. **OTP Expires**: 10 minutes after generation
2. **OTP Attempts**: Max 5 failed attempts, then locked
3. **OTP Limit**: Max 3 active codes per email
4. **Invite Expires**: 7 days
5. **Invite One-Use**: Can only be used once
6. **Membership Soft Delete**: `is_active = false` keeps user in DB
7. **HEAD Bootstrap**: Auto-assign HEAD if no HEAD exists and email matches `FIRST_HEAD_EMAIL`

## Testing OTP Locally

1. Check console logs for generated OTP
2. Or query `otp_codes` table directly in Supabase
3. Resend API will appear to send but won't actually email in development mode

## Migration Checklist

- [ ] Run both migration files on Supabase
- [ ] Verify `memberships` table created
- [ ] Verify existing users have memberships
- [ ] Test OTP generation
- [ ] Test OTP verification
- [ ] Test user creation
- [ ] Test membership creation
- [ ] Test role checks on protected routes
- [ ] Test admin panel

## Key Files to Review

1. **For OTP Logic**: `src/lib/otp-utils.ts`
2. **For Membership Logic**: `src/lib/membership-utils.ts`
3. **For Email Sending**: `src/lib/email.ts`
4. **For Auth Middleware**: `src/lib/auth-utils.ts`
5. **For NextAuth Config**: `src/lib/auth.ts`

## Common Mistakes to Avoid

❌ Using string role names instead of levels
❌ Forgetting to check `is_active` in membership
❌ Calling old `requireRole()` function (use `requireRoleLevel()`)
❌ Not handling OTP expiry in frontend
❌ Trying to assign HEAD without being HEAD
❌ Deleting instead of deactivating users
❌ Using old role names in invites (use role_level)

## Debugging Tips

- Check NextAuth logs for session creation issues
- Check console for missing environment variables
- Check `otp_codes` table for OTP records
- Check `memberships` table for role assignments
- Use `getUserMembership()` to debug role issues
- Use `getSettingsSession()` to debug session issues
