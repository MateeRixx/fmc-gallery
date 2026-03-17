# RBAC Implementation Checklist

Complete checklist to help you implement and test the Role-Based Access Control system.

## Phase 1: Setup (30 minutes)

- [ ] Copy DATABASE_SCHEMA.sql to your project
- [ ] Go to Supabase dashboard SQL editor
- [ ] Paste and run the entire schema
- [ ] Verify `users` table created with correct columns
- [ ] Verify `role_audit_log` table created (optional)
- [ ] Add JWT environment variables to .env.local:
  - [ ] JWT_SECRET
  - [ ] JWT_EXPIRY_DAYS

## Phase 2: Core Files (Already Created)

- [ ] Verify src/types/index.ts has User, JWTPayload, roles, permissions
- [ ] Verify src/lib/rbac.ts exists with utility functions
- [ ] Verify src/lib/jwt.ts exists with token handling
- [ ] Verify src/lib/middleware.ts exists with API middleware
- [ ] Verify src/app/api/auth/login.ts exists
- [ ] Verify src/app/api/admin/users/route.ts exists (GET all users)
- [ ] Verify src/app/api/admin/users/[id]/route.ts exists (PATCH role)
- [ ] Verify src/app/api/admin/users/[id]/permissions.ts exists
- [ ] Verify src/app/api/admin/users/[id]/deactivate.ts exists
- [ ] Verify src/components/UserManagementPanel.tsx exists
- [ ] Verify src/components/YearlyHandoverPanel.tsx exists

## Phase 3: Database Population (15 minutes)

### Create Test Users in Supabase

1. Go to Supabase dashboard → SQL editor
2. Create Head user:
   ```sql
   INSERT INTO users (id, email, role, permissions)
   VALUES (
     gen_random_uuid(),
     'head@club.com',
     'head',
     '{}'
   );
   ```

3. Create Co-Head user:
   ```sql
   INSERT INTO users (id, email, role, permissions)
   VALUES (
     gen_random_uuid(),
     'cohead@club.com',
     'co_head',
     '{}'
   );
   ```

4. Create Executive user:
   ```sql
   INSERT INTO users (id, email, role, permissions)
   VALUES (
     gen_random_uuid(),
     'executive@club.com',
     'executive',
     '{"canAddEvents", "canUploadPhotos"}'
   );
   ```

5. Create Member user:
   ```sql
   INSERT INTO users (id, email, role, permissions)
   VALUES (
     gen_random_uuid(),
     'member@club.com',
     'member',
     '{}'
   );
   ```

- [ ] Verify all test users created in database
- [ ] Copy user IDs for testing later

## Phase 4: Update Login (1 hour)

- [ ] Backup current src/app/login/page.tsx
- [ ] Review LOGIN_PAGE_UPDATED.tsx
- [ ] Update src/app/login/page.tsx to:
  - [ ] Call POST /api/auth/login with email
  - [ ] Handle error responses (inactive, not found)
  - [ ] Call storeToken(data.token) on success
  - [ ] Import storeToken, clearToken from @/lib/jwt
  - [ ] Clear old localStorage items (fmc-admin, etc.)
  - [ ] Redirect to /admin on success
- [ ] Test login with head@club.com
  - [ ] Should receive JWT token
  - [ ] Token stored in localStorage
  - [ ] Redirected to /admin
- [ ] Test login with inactive user
  - [ ] Should get error message
  - [ ] Should not redirect

## Phase 5: Update Admin Page (1 hour)

- [ ] Find your admin page (likely src/app/admin/page.tsx or AdminContent.tsx)
- [ ] Update authentication check to:
  ```tsx
  import { getCurrentUser } from "@/lib/jwt";
  import { isSupremeAdmin } from "@/lib/rbac";
  
  const user = getCurrentUser();
  if (!user || !isSupremeAdmin(user.role)) {
    return <div>Access Denied</div>;
  }
  ```
- [ ] Add UserManagementPanel component:
  ```tsx
  import UserManagementPanel from "@/components/UserManagementPanel";
  <UserManagementPanel />
  ```
- [ ] Add YearlyHandoverPanel component:
  ```tsx
  import YearlyHandoverPanel from "@/components/YearlyHandoverPanel";
  <YearlyHandoverPanel />
  ```
- [ ] Test by logging in as Head
  - [ ] Should see admin panel
  - [ ] Should see user management
  - [ ] Should see handover panel
- [ ] Test by logging in as Executive
  - [ ] Should get access denied

## Phase 6: Protect Existing Routes (2 hours)

For each existing admin API route:

- [ ] Review ROUTE_MIGRATION_EXAMPLES.ts
- [ ] Identify all routes that need protection
- [ ] Replace old authorize() with new middleware:
  ```tsx
  import { requireSupremeAdmin } from "@/lib/middleware";
  const user = await requireSupremeAdmin(request);
  if (user instanceof Response) return user;
  ```
- [ ] Update frontend calls to include Authorization header:
  ```tsx
  const token = localStorage.getItem("fmc-auth-token");
  fetch(url, {
    headers: { "Authorization": `Bearer ${token}` }
  })
  ```
- [ ] Test each route with different user roles

### Routes to update:

- [ ] GET /api/admin/events
- [ ] POST /api/admin/events (create)
- [ ] PATCH /api/admin/events/[id]
- [ ] DELETE /api/admin/events/[id]
- [ ] POST /api/admin/photos
- [ ] DELETE /api/admin/photos/[id]
- [ ] Any other admin routes

## Phase 7: Integration Testing (2 hours)

### Test 1: Login Flow

- [ ] Head login
  - [ ] Can login
  - [ ] Receives JWT token
  - [ ] Token includes role: "head"
- [ ] Co-Head login
  - [ ] Can login
  - [ ] Token includes role: "co_head"
- [ ] Executive login
  - [ ] Can login
  - [ ] Token includes permissions array
- [ ] Member login
  - [ ] Can login
  - [ ] Token includes role: "member"
- [ ] Inactive login
  - [ ] Cannot login
  - [ ] Gets error message
- [ ] Non-existent email
  - [ ] Cannot login
  - [ ] Gets error message

### Test 2: Admin Access

- [ ] Head can access /admin
- [ ] Co-Head can access /admin
- [ ] Executive cannot access /admin (if no canAccessAdminPanel)
- [ ] Member cannot access /admin
- [ ] Inactive cannot access /admin

### Test 3: Role Management

- [ ] Head can change Executive to Co-Head
  - [ ] Old Co-Head demoted to Executive
- [ ] Co-Head can change Executive to Head
  - [ ] Old Head demoted to Executive
- [ ] Executive cannot change roles
- [ ] Non-admin cannot access /api/admin/users

### Test 4: Permission Management

- [ ] Head can grant canAddEvents to Executive
  - [ ] Token updated with new permission
- [ ] Co-Head can revoke canUploadPhotos
- [ ] Executive cannot grant permissions to others
- [ ] Cannot modify permissions for Head/Co-Head

### Test 5: Deactivation

- [ ] Head can deactivate Executive
  - [ ] User marked as Inactive
  - [ ] Cannot login after
  - [ ] All permissions removed
- [ ] Cannot deactivate yourself
- [ ] Audit log records change

### Test 6: Feature Access

- [ ] Head can add events
- [ ] Co-Head can add events
- [ ] Executive with canAddEvents can add events
- [ ] Executive without canAddEvents cannot add events
- [ ] Member cannot add events
- [ ] Head can upload photos
- [ ] Executive with canUploadPhotos can upload
- [ ] Member cannot upload

## Phase 8: Documentation (30 minutes)

- [ ] Read RBAC_IMPLEMENTATION_GUIDE.md completely
- [ ] Review RBAC_QUICK_REFERENCE.md for common tasks
- [ ] Bookmark ROUTE_MIGRATION_EXAMPLES.ts for future route updates
- [ ] Document any custom role/permission logic you add
- [ ] Update project README with new login info

## Phase 9: Security Review (1 hour)

- [ ] Enable RLS (Row Level Security) on users table
  ```sql
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  ```
- [ ] Create RLS policies (see DATABASE_SCHEMA.sql)
- [ ] Verify JWT_SECRET is strong
- [ ] Verify JWT_SECRET is NOT in code (only in .env.local)
- [ ] Test that users cannot modify their own role
- [ ] Test that only Head/Co-Head can manage users
- [ ] Verify audit log tracks all changes
- [ ] Test database queries cannot bypass role checks

## Phase 10: Production Preparation (1 hour)

- [ ] Set strong JWT_SECRET in production .env
- [ ] Enable HTTPS on production domain
- [ ] Set JWT_EXPIRY_DAYS (recommend 30)
- [ ] Set up monitoring/logging for auth failures
- [ ] Backup database schema
- [ ] Create backup strategy for user data
- [ ] Document current Head and Co-Head emails
- [ ] Test login on production
- [ ] Test admin panel on production
- [ ] Test role changes on production
- [ ] Monitor logs for errors

## Phase 11: Team Training (30 minutes)

- [ ] Train Head on user management
  - [ ] How to add new users
  - [ ] How to change roles
  - [ ] How to manage permissions
  - [ ] How to deactivate users
- [ ] Train Head on yearly handover
  - [ ] Use YearlyHandoverPanel component
  - [ ] Step-by-step process
- [ ] Provide RBAC_QUICK_REFERENCE.md to team
- [ ] Setup emergency contact for locked-out Head

## Phase 12: Maintenance (Ongoing)

- [ ] Review audit log monthly
- [ ] Check for inactive users (can be archived)
- [ ] Update permissions as needs change
- [ ] Monitor for security issues
- [ ] Keep JWT_SECRET rotated (optional)
- [ ] Backup user data monthly
- [ ] Test disaster recovery procedures

## Common Issues & Solutions

### "User not found" on login
- [ ] Check user exists in Supabase users table
- [ ] Verify email matches exactly (case-sensitive)
- [ ] Check if user is marked as inactive

### Token validation fails
- [ ] Check JWT_SECRET matches between .env and code
- [ ] Verify token not expired (exp field)
- [ ] Check Authorization header format: `Bearer <token>`

### Cannot access /admin
- [ ] Check user role in database (must be head/co_head)
- [ ] Verify getCurrentUser() returns user data
- [ ] Check isSupremeAdmin() logic in rbac.ts

### Permission not working
- [ ] Verify user role is "executive"
- [ ] Check permissions array in database
- [ ] Verify Permission enum used correctly
- [ ] Check middleware using requirePermission()

### Role change not working
- [ ] Verify user making change is Head/Co-Head
- [ ] Check database for multiple Heads/Co-Heads
- [ ] Review error message in response
- [ ] Check audit log for what happened

## Success Criteria

✅ **System is working when:**

1. Users can login with email and receive JWT token
2. Different roles see different admin features
3. Head and Co-Head can manage all users and roles
4. Executives have limited access based on permissions
5. Members have read-only access
6. Inactive users cannot login
7. All role changes are logged
8. Only 1 Head and 1 Co-Head exist at a time
9. Deactivating user instantly revokes access
10. Yearly handover process is smooth and documented

## Timeline

- **Phase 1**: 30 min
- **Phase 2**: Already done
- **Phase 3**: 15 min
- **Phase 4**: 1 hour
- **Phase 5**: 1 hour
- **Phase 6**: 2 hours
- **Phase 7**: 2 hours
- **Phase 8**: 30 min
- **Phase 9**: 1 hour
- **Phase 10**: 1 hour
- **Phase 11**: 30 min

**Total: ~10 hours of work**

## Next Steps

1. Start with Phase 1: Database setup
2. Verify Phase 2: Files are created (already done)
3. Follow phases in order
4. Test thoroughly in Phase 7
5. Review security in Phase 9
6. Deploy with confidence in Phase 10
