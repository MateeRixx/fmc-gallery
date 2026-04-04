# OTP Authentication System - Implementation Guide

## Overview

This document describes the new OTP-based authentication system with membership-based role management.

## Key Changes from Previous System

| Feature | Old | New |
|---------|-----|-----|
| Auth Method | Email magic links + Google OAuth | OTP-based only |
| Role Storage | Direct in users table | Separate memberships table |
| Role Levels | String-based (head, co_head, etc.) | Numeric (0-3) + string lookup |
| User Deactivation | Deletion | Soft delete via is_active flag |
| Visitor Status | User type field | No membership record |

## Role Levels

```typescript
ROLE_LEVELS = {
  VISITOR: 0,      // No membership (default)
  EXECUTIVE: 1,    // Can create events, upload photos
  CO_HEAD: 2,      // Admin - can manage members
  HEAD: 3          // Full control, transfers role
}
```

## Database Schema Changes

### New Table: memberships
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id) UNIQUE
role_level INT (0-3)
is_active BOOLEAN
start_date TIMESTAMP
end_date TIMESTAMP
```

### Updated users table
- `role` field is now nullable (roles managed via memberships)
- User creation no longer assigns roles directly

## Frontend Integration

### 1. Login Flow (New OTP Process)

```typescript
// Step 1: User requests OTP
const response = await fetch('/api/auth/request-otp', {
  method: 'POST',
  body: JSON.stringify({ email: userEmail }),
});

// Step 2: User enters OTP from email

// Step 3: Verify OTP and create/update user + membership
const verifyResponse = await fetch('/api/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({
    email: userEmail,
    otp: userEnteredOTP,
    full_name: optionalFullName,
    invitation_token: optionalInviteToken,
  }),
});
const { userId, roleLevel } = await verifyResponse.json();

// Step 4: Create NextAuth session with credentials provider
import { signIn } from 'next-auth/react';

signIn('credentials', {
  email: userEmail,
  userId: userId,  // From OTP verification response
  redirect: true,
  callbackUrl: '/',
});
```

### 2. Invitation Flow

**For Inviting Members:**
```typescript
// Admin endpoint to send invite
const response = await fetch('/api/admin/invites/send', {
  method: 'POST',
  body: JSON.stringify({
    email: 'newmember@example.com',
    role_level: 1,  // 0=VISITOR, 1=EXECUTIVE, 2=CO_HEAD, 3=HEAD
  }),
});
```

**For New Members:**
```typescript
// User clicks invite link with token
// Token is extracted from ?token=XYZ query param
// On OTP verification, include invitation_token:

const verifyResponse = await fetch('/api/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({
    email: tokenEmail,
    otp: enteredOTP,
    full_name: enteredName,
    invitation_token: inviteToken,  // From URL params
  }),
});
```

### 3. Admin Panel Integration

**List Members:**
```typescript
const response = await fetch('/api/admin/members?page=1');
const { members, pagination } = await response.json();
// members: { id, email, full_name, role_level, is_active, ... }
```

**Promote Member:**
```typescript
const response = await fetch('/api/admin/members/{userId}/promote', {
  method: 'POST',
  body: JSON.stringify({ role_level: 2 }),  // Promote to CO_HEAD
});
```

**Deactivate Member:**
```typescript
const response = await fetch('/api/admin/members/{userId}/deactivate', {
  method: 'POST',
});
// Note: This keeps user in database but sets is_active=false
```

**Transfer HEAD Role:**
```typescript
const response = await fetch('/api/admin/members/{newHeadId}/transfer-head', {
  method: 'POST',
});
// Only HEAD can call this
// Deactivates current HEAD, activates new HEAD
```

## Session & Type Updates

### Session object now includes:

```typescript
session.user = {
  id: string;
  email: string;
  name: string;
  roleLevel: number;      // 0-3
  roleName: string;       // "VISITOR" | "EXECUTIVE" | "CO_HEAD" | "HEAD"
  isActive: boolean;      // From membership
  isMaster: boolean;      // Email matches MASTER_EMAIL
}
```

### Use in Components:

```typescript
import { useSession } from 'next-auth/react';

export function Dashboard() {
  const { data: session } = useSession();

  if (!session) return <Redirect to="/login" />;

  const isAdmin = session.user.roleLevel >= 2;  // CO_HEAD or HEAD
  const isExecutive = session.user.roleLevel >= 1;
  const isHead = session.user.roleLevel === 3;

  if (!session.user.isActive) {
    return <p>Your account is inactive</p>;
  }

  return <div>Welcome, {session.user.name}!</div>;
}
```

## Protected Routes

### API Route Protection:

```typescript
// Require authentication
import { withAuth } from '@/lib/auth-utils';
export const GET = withAuth(async (req, user) => {
  // user is authenticated
});

// Require EXECUTIVE+
import { withAuthExecutive } from '@/lib/auth-utils';
export const POST = withAuthExecutive()(async (req, user) => {
  // user is EXECUTIVE or above
});

// Require CO_HEAD (admin)
import { withAuthCoHead } from '@/lib/auth-utils';
export const POST = withAuthCoHead()(async (req, user) => {
  // user is CO_HEAD or HEAD
});

// Require HEAD only
import { withAuthHead } from '@/lib/auth-utils';
export const POST = withAuthHead()(async (req, user) => {
  // user is HEAD
});
```

### Next.js Page Middleware:

```typescript
// pages/admin/members.tsx
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function MembersPage() {
  const session = await getServerSession(authOptions);

  // Redirect if not authenticated
  if (!session?.user) {
    redirect('/login');
  }

  // Redirect if not admin
  if (session.user.roleLevel < 2) {
    redirect('/unauthorized');
  }

  // User is admin, render page
  return <AdminMembersPanel />;
}
```

## Environment Variables

Add these (already in .env.example):
```env
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secret-key
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=noreply@yoursite.com
FIRST_HEAD_EMAIL=your@email.com  # (optional, for bootstrap)
```

## Migration Path

### For Existing Users:

Users are automatically migrated when:
1. They log in via OTP (creates membership)
2. They're invited (membership created with invite role)
3. Manual migration script can batch create memberships

### For Existing Routes:

Gradually update protected routes from:
```typescript
// Old
const user = await requireAuth();
if (user.role !== 'head') return error;

// New
const user = await requireHead();
```

Or use role level:
```typescript
// Old
const user = await requireAdmin();

// New
const user = await requireCoHead();  // CO_HEAD+
```

## Bootstrap (First HEAD)

On first login:
1. If no HEAD exists in database
2. And email matches `FIRST_HEAD_EMAIL` env var
3. Membership created with `role_level: 3` (HEAD)

After bootstrap, only HEAD can create other admins.

## Security Considerations

1. **OTP Security:**
   - 6-digit OTP expires in 10 minutes
   - Max 5 verification attempts
   - Max 3 active OTPs per email at once

2. **Invitation Security:**
   - UUID tokens (cryptographically random)
   - 7-day expiry
   - Can only be used once
   - Email address must match

3. **Role Transfer:**
   - Only HEAD can transfer HEAD role
   - Current HEAD is deactivated (not deleted)
   - Prevents accidental orphaning

4. **Admin Checks:**
   - All admin endpoints verify permissions
   - Role levels prevent unauthorized escalation
   - Cannot deactivate yourself

## Testing Checklist

- [ ] OTP request generates and sends email
- [ ] OTP verify creates user and membership
- [ ] Visitor login (no membership) works
- [ ] Invited user gets correct role
- [ ] First HEAD bootstrap works
- [ ] Admin can promote/demote members
- [ ] Admin can deactivate members
- [ ] Only HEAD can transfer HEAD role
- [ ] Protected routes enforce role levels
- [ ] Session includes all membership data
