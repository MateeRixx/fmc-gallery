# RBAC Implementation Guide

## Overview

This guide walks you through implementing the complete Role-Based Access Control (RBAC) system for the FMC Gallery application.

## System Architecture

The RBAC system consists of:

1. **Roles**: Head, Co-Head, Executive, Member, Inactive
2. **Permissions**: Granular permissions for Executives (canAddEvents, canUploadPhotos, etc.)
3. **JWT Tokens**: Include role and permissions for quick authorization checks
4. **Middleware**: Protect API routes based on roles and permissions
5. **Admin Dashboard**: Manage users, roles, and permissions

## Setup Steps

### 1. Database Schema Setup

**Location**: `DATABASE_SCHEMA.sql`

1. Go to your Supabase dashboard
2. Open the SQL editor
3. Copy the entire contents of `DATABASE_SCHEMA.sql`
4. Paste and run in your Supabase SQL editor
5. This creates:
   - `users` table with role and permissions
   - `role_audit_log` table for tracking changes
   - Indexes for performance
   - Optional RLS policies for security

### 2. Environment Variables

Add these to your `.env.local`:

```dotenv
# JWT Configuration
JWT_SECRET="your-super-secret-key-change-in-production"
JWT_EXPIRY_DAYS="30"

# Keep existing Supabase variables
NEXT_PUBLIC_SUPABASE_URL="..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
ADMIN_API_TOKEN="..."
```

### 3. Update Login Flow

**Replace**: `src/app/login/page.tsx`

The login flow now:
1. Accepts email
2. Looks up user in the `users` table
3. Creates a JWT token with role and permissions
4. Stores token in localStorage as `fmc-auth-token`
5. Checks if user is inactive (blocks access)

### 4. Update Admin Panel

Update your admin page to include the new user management and handover components:

```tsx
// src/app/admin/AdminContent.tsx or AdminPage.tsx

import UserManagementPanel from "@/components/UserManagementPanel";
import YearlyHandoverPanel from "@/components/YearlyHandoverPanel";
import { getCurrentUser, isAuthenticated } from "@/lib/jwt";
import { isSupremeAdmin } from "@/lib/rbac";

export default async function AdminPage() {
  const user = getCurrentUser();
  
  if (!isAuthenticated() || !isSupremeAdmin(user?.role)) {
    return <div>Access Denied</div>;
  }

  return (
    <div className="space-y-8">
      {/* Existing admin components */}
      
      {/* New RBAC components - only show to Head/Co-Head */}
      {isSupremeAdmin(user.role) && (
        <>
          <UserManagementPanel />
          <YearlyHandoverPanel />
        </>
      )}
    </div>
  );
}
```

## API Routes

### Authentication Routes

**POST `/api/auth/login`**
- Authenticate user and return JWT token
- Request: `{ email: string }`
- Response: `{ success: boolean, token: string, user: User }`

### User Management Routes

**GET `/api/admin/users`**
- Get all users (Head/Co-Head only)
- Headers: `Authorization: Bearer <token>`

**PATCH `/api/admin/users/[id]`**
- Change user role (Head/Co-Head only)
- Request: `{ newRole: UserRole }`
- Automatically demotes existing Head/Co-Head if promoting

**POST `/api/admin/users/[id]/permissions`**
- Grant/revoke permissions for Executive (Head/Co-Head only)
- Request: `{ permissions: Permission[], action: "set" | "grant" | "revoke" }`

**POST `/api/admin/users/[id]/deactivate`**
- Mark user as inactive, revoke all access (Head/Co-Head only)
- Instant access revocation

## Using the RBAC System

### In Frontend Components

```tsx
import { getCurrentUser } from "@/lib/jwt";
import { isSupremeAdmin, hasPermission } from "@/lib/rbac";
import { Permission } from "@/types";

export default function MyComponent() {
  const user = getCurrentUser();
  
  if (!user) {
    return <div>Not authenticated</div>;
  }
  
  // Check if Head or Co-Head
  if (isSupremeAdmin(user.role)) {
    return <div>Full admin access</div>;
  }
  
  // Check if has specific permission
  if (hasPermission(user, Permission.CAN_ADD_EVENTS)) {
    return <div>Can add events</div>;
  }
  
  return <div>No permission</div>;
}
```

### In API Routes

```tsx
import { requireAuth, requireSupremeAdmin, requirePermission } from "@/lib/middleware";
import { Permission } from "@/types";

export async function POST(request: Request) {
  // Require authentication
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  
  // Require Head or Co-Head
  const supremeUser = await requireSupremeAdmin(request);
  if (supremeUser instanceof Response) return supremeUser;
  
  // OR require specific permission
  const permissionUser = await requirePermission(request, Permission.CAN_ADD_EVENTS);
  if (permissionUser instanceof Response) return permissionUser;
  
  // Route logic
  return Response.json({ success: true });
}
```

## Yearly Handover Workflow

Use the `YearlyHandoverPanel` component or manually:

### Step 1: Promote Old Co-Head to Head
```
PATCH /api/admin/users/[coHeadId]
{ "newRole": "head" }
```
- Old Head is automatically demoted to Executive

### Step 2: Promote Executive to New Co-Head
```
PATCH /api/admin/users/[executiveId]
{ "newRole": "co_head" }
```

### Step 3: Add New Executives
Create new user records with role "executive"

### Step 4: Set Permissions for New Executives
```
POST /api/admin/users/[executiveId]/permissions
{ 
  "permissions": ["canAddEvents", "canUploadPhotos"],
  "action": "set"
}
```

### Step 5: Deactivate Departing Members
```
POST /api/admin/users/[departingUserId]/deactivate
```
- Instant access revocation
- All permissions removed

## Security Checklist

- [ ] JWT secret is strong and in environment variables
- [ ] Database RLS policies are enabled
- [ ] Only Head/Co-Head can access `/admin` routes
- [ ] Token validation on every protected route
- [ ] Audit log tracks all role changes
- [ ] Inactive users cannot login
- [ ] Only 1 Head at a time (enforced by API)
- [ ] Only 1 Co-Head at a time (enforced by API)
- [ ] Users cannot modify their own role
- [ ] Rate limiting on login endpoint
- [ ] HTTPS enforced in production
- [ ] Sensitive endpoints require re-authentication

## Files Created/Modified

### New Files
- `src/lib/rbac.ts` - RBAC utility functions
- `src/lib/jwt.ts` - JWT handling
- `src/lib/middleware.ts` - API middleware functions
- `src/app/api/auth/login.ts` - Authentication endpoint
- `src/app/api/admin/users/route.ts` - Get all users
- `src/app/api/admin/users/[id]/route.ts` - Change role
- `src/app/api/admin/users/[id]/permissions.ts` - Manage permissions
- `src/app/api/admin/users/[id]/deactivate.ts` - Deactivate user
- `src/components/UserManagementPanel.tsx` - Admin dashboard
- `src/components/YearlyHandoverPanel.tsx` - Yearly handover UI
- `DATABASE_SCHEMA.sql` - Database setup

### Modified Files
- `src/types/index.ts` - Added User, JWTPayload, role/permission enums

## Common Tasks

### Add a New Permission Type

1. Add to `Permission` enum in `src/types/index.ts`
2. Add to `formatPermission()` in `src/lib/rbac.ts`
3. Update database schema if needed

### Change Login Page

The new JWT-based system replaces the old localStorage-based system. Update your login page to:

```tsx
const response = await fetch("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email }),
});

const data = await response.json();
storeToken(data.token); // From src/lib/jwt.ts
router.push("/admin");
```

### Protect an Existing Route

Replace old token check with middleware:

```tsx
// Old way
const token = request.headers.get("authorization")?.replace("Bearer ", "");
if (token !== process.env.ADMIN_API_TOKEN) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

// New way
const user = await requirePermission(request, Permission.CAN_UPLOAD_PHOTOS);
if (user instanceof Response) return user;

// Use user.sub, user.email, user.role, user.permissions
```

## Troubleshooting

### "User not found" error when logging in
- Check if the email exists in the `users` table in Supabase
- Use Supabase dashboard to create test user records

### Token validation fails
- Check if JWT_SECRET matches between token creation and validation
- Verify token hasn't expired (check exp field)
- Ensure Authorization header format is correct: `Bearer <token>`

### Role change not working
- Ensure user making change has Head or Co-Head role
- Check database for conflicts (multiple Heads/Co-Heads)
- Verify user exists in database

### Permissions not applying
- Only Executives can have custom permissions
- Head/Co-Head have all permissions implicitly
- Check database schema for permissions array column

## Next Steps

1. Run database schema setup
2. Update login page
3. Create initial Head user in database
4. Update admin page to include new components
5. Protect existing API routes with middleware
6. Test role changes with admin panel
7. Deploy with updated environment variables

## Support

For issues or questions:
1. Check database schema in Supabase
2. Review JWT token payload (decode in jwt.io)
3. Check browser console for errors
4. Review server logs for API errors
5. Verify environment variables are set correctly
