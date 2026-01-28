# RBAC System - Visual Diagrams & Flowcharts

## 1. Role Hierarchy

```
                          ┌─────────────────────────┐
                          │         Head            │
                          │   (1 person max)        │
                          │  Full Supreme Admin      │
                          │  Can do ANYTHING        │
                          └────────────┬────────────┘
                                       │
                                       │ Changes to
                                       ▼
                          ┌─────────────────────────┐
                          │       Co-Head           │
                          │   (1 person max)        │
                          │  Full Supreme Admin      │
                          │  Same rights as Head    │
                          └────────────┬────────────┘
                                       │
                                       │ Changes to
                                       ▼
                          ┌─────────────────────────┐
                          │      Executive          │
                          │  (Multiple people)      │
                          │  Limited Permissions    │
                          │  Can add/upload own     │
                          └────────────┬────────────┘
                                       │
                                       │ Can be demoted to
                                       ▼
                          ┌─────────────────────────┐
                          │       Member            │
                          │   Normal user           │
                          │    Read-only            │
                          └────────────┬────────────┘
                                       │
                                       │ Can be marked
                                       ▼
                          ┌─────────────────────────┐
                          │      Inactive           │
                          │  No access instantly    │
                          │ (someone left club)     │
                          └─────────────────────────┘
```

## 2. Permission Matrix

```
╔════════════════════╦═══════╦═════════╦════════════╦════════╦══════════╗
║ Permission         ║ Head  ║ Co-Head ║ Executive* ║ Member ║ Inactive ║
╠════════════════════╬═══════╬═════════╬════════════╬════════╬══════════╣
║ canAddEvents       ║  ✓    ║    ✓    ║  ✓ grant   ║   ✗    ║    ✗     ║
║ canEditEvents      ║  ✓    ║    ✓    ║  ✓ grant   ║   ✗    ║    ✗     ║
║ canDeleteEvents    ║  ✓    ║    ✓    ║  ✓ grant   ║   ✗    ║    ✗     ║
║ canUploadPhotos    ║  ✓    ║    ✓    ║  ✓ grant   ║   ✗    ║    ✗     ║
║ canDeletePhotos    ║  ✓    ║    ✓    ║  ✓ grant   ║   ✗    ║    ✗     ║
║ canManageMembers   ║  ✓    ║    ✓    ║  ✓ grant   ║   ✗    ║    ✗     ║
║ canGrantPerms      ║  ✓    ║    ✓    ║  ✓ grant   ║   ✗    ║    ✗     ║
║ canViewAnalytics   ║  ✓    ║    ✓    ║  ✓ grant   ║   ✗    ║    ✗     ║
║ canAccessAdmin     ║  ✓    ║    ✓    ║  ✓ grant   ║   ✗    ║    ✗     ║
╚════════════════════╩═══════╩═════════╩════════════╩════════╩══════════╝

* Executive: Permissions are custom, granted by Head/Co-Head
✓ = Has permission
✗ = No permission
✓ grant = Needs to be granted by Head/Co-Head
```

## 3. Yearly Handover Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  YEARLY ROLE HANDOVER                           │
│                    (December to January)                        │
└─────────────────────────────────────────────────────────────────┘

BEFORE HANDOVER:
┌──────────────────┐
│   Year 1 Roles   │
├──────────────────┤
│ Head: Alice      │
│ Co-Head: Bob     │
│ Exec: Charlie    │
│ Exec: Diana      │
│ Member: Eve      │
└──────────────────┘

                        ↓↓↓ HANDOVER STEPS ↓↓↓

STEP 1: Promote Co-Head to Head
  Bob: Co-Head → Head
  Alice: Head → Executive (automatic demotion)
  
┌──────────────────┐
│  After Step 1    │
├──────────────────┤
│ Head: Bob        │
│ Co-Head: (none)  │
│ Exec: Alice      │
│ Exec: Charlie    │
│ Exec: Diana      │
│ Member: Eve      │
└──────────────────┘

STEP 2: Promote Executive to Co-Head
  Charlie: Executive → Co-Head
  
┌──────────────────┐
│  After Step 2    │
├──────────────────┤
│ Head: Bob        │
│ Co-Head: Charlie │
│ Exec: Alice      │
│ Exec: Diana      │
│ Member: Eve      │
└──────────────────┘

STEP 3: Add New Executives
  Frank: New → Executive
  Grace: New → Executive
  
┌──────────────────┐
│  After Step 3    │
├──────────────────┤
│ Head: Bob        │
│ Co-Head: Charlie │
│ Exec: Alice      │
│ Exec: Diana      │
│ Exec: Frank      │
│ Exec: Grace      │
│ Member: Eve      │
└──────────────────┘

STEP 4: Set Permissions for New Execs
  Frank: grant canAddEvents, canUploadPhotos
  Grace: grant canUploadPhotos
  
STEP 5: Deactivate Departing Members
  Eve: Member → Inactive (left the club)
  
┌──────────────────────┐
│  After Step 5        │
│  (FINAL - Year 2)    │
├──────────────────────┤
│ Head: Bob            │
│ Co-Head: Charlie     │
│ Exec: Alice          │
│ Exec: Diana          │
│ Exec: Frank          │
│ Exec: Grace          │
│ Inactive: Eve        │
└──────────────────────┘
```

## 4. Authentication Flow

```
┌─────────────┐
│  User       │
│  Enters     │
│  Email      │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│  POST /api/auth/     │
│  login               │
│  { email: "..." }    │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Server: Look up user in database    │
│  Get: id, email, role, permissions   │
└──────┬───────────────────────────────┘
       │
       ├─ User found?
       │
       ├─ YES → Is role = inactive?
       │        │
       │        ├─ YES → Return 403 "Account inactive"
       │        │
       │        ├─ NO → Create JWT token
       │               {
       │                 sub: user.id,
       │                 email: user.email,
       │                 role: user.role,
       │                 permissions: user.permissions,
       │                 exp: now + 30 days
       │               }
       │               │
       │               ▼
       │        Return 200 + token
       │               │
       │               ▼
       │        Browser stores in localStorage
       │        Key: "fmc-auth-token"
       │               │
       │               ▼
       │        Redirect to /admin
       │
       ├─ NO → Return 401 "Email not authorized"
```

## 5. API Route Protection Flow

```
┌──────────────────────────┐
│  Frontend API Call       │
│  with JWT Token          │
│  Authorization: Bearer   │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────────┐
│  API Route Handler           │
│  (e.g., POST /api/admin/...)│
└────────────┬─────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│  Middleware: Extract Token         │
│  from Authorization header         │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│  Middleware: Validate Token        │
│  Check signature, expiry, etc.     │
└────────────┬───────────────────────┘
             │
             ├─ Valid?
             │
             ├─ YES → Decode payload
             │        Get: user.role, user.permissions
             │        │
             │        ▼
             │   Check required access level
             │        │
             │        ├─ Head/Co-Head? → Allow
             │        ├─ Has permission? → Allow
             │        ├─ Member/Inactive? → Deny
             │        │
             │        ▼
             │   Route logic or 403 Forbidden
             │
             ├─ NO → Return 401 Unauthorized
```

## 6. User Management Component Flow

```
┌──────────────────────────────────┐
│  Admin Views User Management     │
│         Component                │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│  Component: Fetch all users      │
│  GET /api/admin/users            │
│  Authorization: Bearer token     │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│  Display users table             │
│  Columns:                        │
│  - Email                        │
│  - Name                         │
│  - Role (badge colored)         │
│  - Permissions                  │
│  - Actions buttons              │
└────────────┬─────────────────────┘
             │
             ├─ Admin clicks "Change Role"
             │  │
             │  ▼
             │  ┌─────────────────────┐
             │  │ Modal: Select Role  │
             │  │ Radio buttons       │
             │  │ with all 5 roles    │
             │  └────────┬────────────┘
             │           │
             │           ▼
             │  ┌─────────────────────┐
             │  │ Admin clicks submit │
             │  │ PATCH /api/admin/   │
             │  │ users/[id]          │
             │  │ { newRole: "..." }  │
             │  └────────┬────────────┘
             │           │
             │           ├─ Success?
             │           │
             │           ├─ YES → Show toast "Role updated"
             │           │        Refresh user list
             │           │
             │           ├─ NO → Show error message
             │
             ├─ Admin clicks "Permissions"
             │  │
             │  ▼
             │  ┌──────────────────────┐
             │  │ Modal: Grant Perms   │
             │  │ Checkboxes for all   │
             │  │ 9 permissions        │
             │  └────────┬─────────────┘
             │           │
             │           ▼
             │  ┌──────────────────────┐
             │  │ Admin selects perms  │
             │  │ Clicks "Save"        │
             │  │ POST /api/admin/     │
             │  │ users/[id]/perms     │
             │  └────────┬─────────────┘
             │           │
             │           ├─ Success?
             │           │
             │           ├─ YES → Refresh table
             │           │        Show new perms
             │           │
             │           ├─ NO → Show error
             │
             └─ Admin clicks "Deactivate"
                │
                ▼
                ┌──────────────────────┐
                │ Confirm Dialog       │
                │ "Are you sure?"      │
                └────────┬─────────────┘
                         │
                         ├─ User confirms
                         │  │
                         │  ▼
                         │  ┌──────────────────┐
                         │  │ POST /api/admin/ │
                         │  │ users/[id]/      │
                         │  │ deactivate       │
                         │  └────────┬─────────┘
                         │           │
                         │           ├─ Success?
                         │           │
                         │           ├─ YES → Refresh
                         │           │        User now
                         │           │        shows as
                         │           │        Inactive
                         │           │
                         │           ├─ NO → Show error
                         │
                         └─ User cancels → Close modal
```

## 7. Token Structure

```
JWT Token Structure:
┌─────────────────────────────────────────┐
│ Header.Payload.Signature                │
└─────────────────────────────────────────┘

Example Decoded Payload:
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",  ← User ID
  "email": "head@club.com",                        ← User email
  "role": "head",                                  ← User role
  "permissions": [],                               ← Granted perms
  "iat": 1704067200,                               ← Issued at
  "exp": 1706745600                                ← Expires
}

Access Control Decision Based on Token:
┌──────────────────┐
│ Token Payload    │
├──────────────────┤
│ role: "head"     │ ─► Has all permissions implicitly
│ permissions: []  │
└──────────────────┘

┌──────────────────┐
│ Token Payload    │
├──────────────────┤
│ role: "co_head"  │ ─► Has all permissions implicitly
│ permissions: []  │
└──────────────────┘

┌──────────────────┐
│ Token Payload    │
├──────────────────┤
│ role: "executive"│ ─► Check permissions array for specific perm
│ permissions:     │
│ ["canAddEvents", │
│  "canUploadPhotos"]
└──────────────────┘

┌──────────────────┐
│ Token Payload    │
├──────────────────┤
│ role: "member"   │ ─► No special permissions, read-only
│ permissions: []  │
└──────────────────┘

┌──────────────────┐
│ Token Payload    │
├──────────────────┤
│ role: "inactive" │ ─► No access (but shouldn't have token)
│ permissions: []  │
└──────────────────┘
```

## 8. Enforcement Points

```
Browser
  ↓
  ├─ Client-side: getCurrentUser() → show/hide UI
  │  (for UX only, not secure)
  │
  ↓
Server
  ├─ Authorization Header Check → Extract JWT
  │
  ├─ Token Validation → Signature, expiry
  │
  ├─ Role Check → Is Head? Co-Head? Executive?
  │
  ├─ Permission Check → Does permissions array include "..."?
  │
  ├─ Middleware Response → Allow or 403 Forbidden
  │
  ├─ Route Logic → Execute with verified user context
  │
  └─ Database Update → Log the change (audit trail)
```

## 9. Decision Tree: Can user perform action?

```
                    ┌─────────────────────┐
                    │  User wants to do   │
                    │  something          │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Has valid JWT?     │
                    │  (not expired)      │
                    └──┬──────────────┬───┘
                      NO            YES
                       │             │
                       │             ▼
                       │    ┌──────────────────┐
                       │    │ Get user from    │
                       │    │ token payload    │
                       │    │ role, perms      │
                       │    └────────┬─────────┘
                       │             │
                       ▼             ▼
                    ┌──────────────────────────┐
                    │ Is user INACTIVE?        │
                    └──┬──────────────────┬────┘
                      YES               NO
                       │                 │
                       │                 ▼
                       │    ┌────────────────────────┐
                       │    │ What action needed?    │
                       │    └──┬──────────┬──┬───────┘
                       │      /           |   \
                       │    /             |     \
                       │  /               |       \
                       ▼ ▼               ▼         ▼
                    ┌─────────────────────────────────┐
                    │  Admin Action?  │  Has Perm?   │
                    │  (role change)  │  (add event) │
                    └──┬───────────┬───┴──┬────┬──────┘
                       │           │      YES  NO
                       │           │      │    │
                     HEAD?        HEAD?   │    │
                       │           │      │    │
                      YES         YES     │    │
                       │           │      │    │
                    ALLOW       ALLOW     │    │
                                        ▼    ▼
                                    ALLOW  DENY
```

These diagrams should help visualize how the RBAC system works. Print or save these for reference during implementation!
