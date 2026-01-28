# RBAC System - Quick Reference Cheat Sheet

## Roles & Permissions Overview

### User Roles

```
┌─────────────┬────────────────────────────────────────────────────┐
│ Role        │ Description                                        │
├─────────────┼────────────────────────────────────────────────────┤
│ Head        │ 1 person max. Full supreme admin. Can do ANYTHING. │
│ Co-Head     │ 1 person max. Same rights as Head.                │
│ Executive   │ Multiple people. Limited access + custom perms.   │
│ Member      │ Normal user. Read-only.                           │
│ Inactive    │ No access. Instant revocation.                    │
└─────────────┴────────────────────────────────────────────────────┘
```

### Executive Permissions

```
canAddEvents          - Create new events
canEditEvents         - Edit all events
canDeleteEvents       - Delete events
canUploadPhotos       - Upload photos
canDeletePhotos       - Delete photos
canManageMembers      - Invite/remove users
canGrantPermissions   - Grant perms to other Executives
canViewAnalytics      - View statistics
canAccessAdminPanel   - Access admin dashboard
```

## Common Code Snippets

### Check User Role (Frontend)

```tsx
import { getCurrentUser } from "@/lib/jwt";
import { isSupremeAdmin } from "@/lib/rbac";

const user = getCurrentUser();
if (isSupremeAdmin(user?.role)) {
  // Show admin features
}
```

### Check Permission (Frontend)

```tsx
import { hasPermission } from "@/lib/rbac";
import { Permission } from "@/types";

if (hasPermission(user, Permission.CAN_ADD_EVENTS)) {
  // Show add event button
}
```

### Protect API Route (Backend)

```tsx
import { requireSupremeAdmin } from "@/lib/middleware";

export async function POST(request: Request) {
  const user = await requireSupremeAdmin(request);
  if (user instanceof Response) return user;
  
  // Protected logic here
}
```

### Frontend API Call with Auth

```tsx
const token = localStorage.getItem("fmc-auth-token");
const response = await fetch("/api/admin/users", {
  headers: {
    "Authorization": `Bearer ${token}`,
  },
});
```

## Yearly Handover Workflow

### Scenario: Transition from Year 1 to Year 2

**Before**:
```
Head:        Alice
Co-Head:     Bob
Executive:   Charlie, Diana
Member:      Eve
```

**Steps**:

1. Promote Bob (Co-Head) to Head
   ```
   PATCH /api/admin/users/bob-id { "newRole": "head" }
   ```
   → Alice automatically becomes Executive

2. Promote Charlie (Executive) to Co-Head
   ```
   PATCH /api/admin/users/charlie-id { "newRole": "co_head" }
   ```

3. Add new Executive Frank
   ```
   Create user: Frank with role "executive"
   ```

4. Set Frank's permissions
   ```
   POST /api/admin/users/frank-id/permissions
   {
     "permissions": ["canAddEvents", "canUploadPhotos"],
     "action": "set"
   }
   ```

5. Deactivate Eve (left the club)
   ```
   POST /api/admin/users/eve-id/deactivate
   ```

**After**:
```
Head:        Bob
Co-Head:     Charlie
Executive:   Alice, Diana, Frank
Member:      (none)
Inactive:    Eve
```

## Database Queries

### Get current Head
```sql
SELECT * FROM users WHERE role = 'head';
```

### Get all active users
```sql
SELECT * FROM users WHERE role != 'inactive' ORDER BY created_at DESC;
```

### Get users with specific permission
```sql
SELECT * FROM users WHERE 'canAddEvents' = ANY(permissions);
```

### View role change history
```sql
SELECT * FROM role_audit_log ORDER BY changed_at DESC LIMIT 50;
```

## Error Messages Reference

```
"Missing authentication token"
→ Add Authorization header with Bearer token

"Invalid or expired token"
→ Login again, token may have expired (30 days default)

"Only Head or Co-Head can access this"
→ User doesn't have supreme admin rights

"You don't have permission to [action]"
→ User is Executive without required permission

"Your account is inactive. Contact your administrator."
→ User was deactivated, cannot login

"User not found"
→ Email not in users table

"Can only manage permissions for Executives"
→ Trying to manage perms for Head/Co-Head (they have all)
```

## File Structure

```
src/
  lib/
    rbac.ts              ← Utility functions for role checks
    jwt.ts               ← Token creation/validation
    middleware.ts        ← API route middleware
  app/
    api/
      auth/
        login.ts         ← Login endpoint
      admin/
        users/
          route.ts       ← Get all users
          [id]/
            route.ts     ← Change role
            permissions.ts ← Manage permissions
            deactivate.ts  ← Mark inactive
  components/
    UserManagementPanel.tsx    ← Admin dashboard
    YearlyHandoverPanel.tsx    ← Handover guide
  types/
    index.ts             ← Role/Permission enums

DATABASE_SCHEMA.sql      ← Database setup script
RBAC_IMPLEMENTATION_GUIDE.md ← Full setup guide
```

## Environment Variables

```dotenv
# Required
JWT_SECRET="your-secret-key"
JWT_EXPIRY_DAYS="30"

# Existing (keep these)
NEXT_PUBLIC_SUPABASE_URL="..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
ADMIN_API_TOKEN="..."
```

## Debugging Tips

### Check token validity
```tsx
import { verifyJWT } from "@/lib/jwt";
const payload = verifyJWT(token);
console.log(payload); // Should show role and permissions
```

### Check user permissions
```tsx
import { hasPermission } from "@/lib/rbac";
console.log(hasPermission(user, Permission.CAN_ADD_EVENTS));
```

### View token in browser
```js
localStorage.getItem("fmc-auth-token")
// Copy and paste at jwt.io to decode
```

### Check database
Use Supabase dashboard:
1. Go to SQL editor
2. Run: `SELECT id, email, role, permissions FROM users;`
3. Verify roles and permissions are correct

## Security Reminders

✅ **DO:**
- Use HTTPS in production
- Store JWT_SECRET in environment variables
- Validate tokens on every protected route
- Log all role changes (audit_log)
- Require re-auth for sensitive actions
- Use RLS policies on database

❌ **DON'T:**
- Store JWT_SECRET in code
- Trust client-side role checks alone
- Allow users to modify their own role
- Log sensitive user data
- Expose error details to clients
- Use weak JWT secrets

## Links

- [JWT.io](https://jwt.io) - Decode tokens for debugging
- [Supabase Docs](https://supabase.io/docs) - Database docs
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction) - API docs
- [TypeScript Handbook](https://www.typescriptlang.org/docs) - TypeScript docs

## Support

1. Check logs: `console.log()` statements
2. Decode token: Use jwt.io
3. Query DB: Use Supabase SQL editor
4. Review guide: Read RBAC_IMPLEMENTATION_GUIDE.md
5. Check types: Verify TypeScript interfaces in src/types/index.ts
