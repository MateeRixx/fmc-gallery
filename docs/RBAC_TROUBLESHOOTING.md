# RBAC System - Troubleshooting Guide

## Common Issues & Solutions

### 1. Login Issues

#### Problem: "Email not authorized for access"
```
Error on login: "❌ Email not authorized for access"
```

**Causes:**
- User doesn't exist in the `users` table
- Email doesn't match exactly (case-sensitive)
- Email has extra spaces

**Solutions:**
1. Check Supabase SQL:
   ```sql
   SELECT * FROM users WHERE email = 'user@example.com';
   ```
2. If not found, create user:
   ```sql
   INSERT INTO users (id, email, role, permissions)
   VALUES (
     gen_random_uuid(),
     'user@example.com',
     'executive',
     '{"canAddEvents", "canUploadPhotos"}'
   );
   ```
3. Verify email in login form matches exactly
4. Check for leading/trailing spaces

---

#### Problem: "Your account is inactive"
```
Error: "Your account is inactive. Contact your administrator."
```

**Causes:**
- User's role is "inactive"
- Someone deactivated this user

**Solutions:**
1. Check role in database:
   ```sql
   SELECT email, role FROM users WHERE email = 'user@example.com';
   ```
2. If role is "inactive", change it:
   ```sql
   UPDATE users 
   SET role = 'executive'
   WHERE email = 'user@example.com';
   ```
3. Or ask Head/Co-Head to activate via admin panel

---

#### Problem: Login succeeds but no redirect
```
Login appears to work but doesn't redirect to /admin
```

**Causes:**
- Token not stored in localStorage
- getCurrentUser() returns null
- Router.push() not working

**Solutions:**
1. Check browser console for errors
2. Check localStorage:
   ```javascript
   // In browser console:
   localStorage.getItem("fmc-auth-token")
   // Should show a token
   ```
3. Verify storeToken() is called:
   ```tsx
   // In LOGIN_PAGE_UPDATED.tsx
   storeToken(data.token); // Must be called
   ```
4. Check that router.push("/admin") is called after

---

#### Problem: Login works but stored token is invalid
```
Token stored but /admin says "Not authenticated"
```

**Causes:**
- Token wasn't created correctly
- Token is corrupted
- verifyJWT() logic is wrong

**Solutions:**
1. Decode token at jwt.io:
   ```javascript
   // Copy from localStorage:
   localStorage.getItem("fmc-auth-token")
   // Paste into jwt.io
   // Check that payload has: sub, email, role, permissions
   ```
2. Verify JWT_SECRET is same everywhere:
   - .env.local: JWT_SECRET=...
   - src/lib/jwt.ts uses same secret
3. Check token expiry:
   ```javascript
   // In browser console:
   const token = localStorage.getItem("fmc-auth-token");
   const parts = token.split(".");
   const payload = JSON.parse(atob(parts[1]));
   console.log("Expires at:", new Date(payload.exp * 1000));
   ```

---

### 2. Admin Access Issues

#### Problem: "Access Denied" on /admin page
```
Can login but /admin shows "Access Denied"
```

**Causes:**
- User role is not Head or Co-Head
- getCurrentUser() returns null
- isSupremeAdmin() check is wrong

**Solutions:**
1. Check user's role:
   ```sql
   SELECT email, role FROM users;
   ```
2. If not Head/Co-Head, promote:
   ```sql
   UPDATE users 
   SET role = 'head'
   WHERE email = 'user@example.com';
   ```
3. Make sure login creates new token after role change
4. Clear localStorage and login again:
   ```javascript
   localStorage.removeItem("fmc-auth-token");
   // Then login again
   ```

---

#### Problem: "User Management" component doesn't load
```
/admin page loads but UserManagementPanel shows error
```

**Causes:**
- GET /api/admin/users fails
- Missing Authorization header
- Token is invalid

**Solutions:**
1. Check network tab (F12 → Network):
   - Look for GET /api/admin/users request
   - Check status code (should be 200)
   - Check response for error message
2. If 401 Unauthorized:
   - Token not sent or invalid
   - Clear localStorage and login again
3. If 403 Forbidden:
   - User is not Head/Co-Head
   - Update user role in database
4. Check middleware in route.ts:
   ```tsx
   const user = await requireSupremeAdmin(request);
   if (user instanceof Response) return user;
   ```

---

### 3. Role Change Issues

#### Problem: Role change doesn't work
```
Try to change user role but get error or no change
```

**Causes:**
- Not authenticated as Head/Co-Head
- User ID is wrong
- Invalid role value

**Solutions:**
1. Verify you're logged in as Head/Co-Head:
   ```javascript
   // In browser console:
   JSON.parse(atob(localStorage.getItem("fmc-auth-token").split(".")[1])).role
   // Should show "head" or "co_head"
   ```
2. Check user ID:
   ```sql
   SELECT id, email FROM users;
   // Use the UUID, not email
   ```
3. Verify role value is valid:
   ```
   Allowed: "head", "co_head", "executive", "member", "inactive"
   Not allowed: "Head", "HEAD", "admin", etc.
   ```
4. Check network response for error:
   - F12 → Network → Find PATCH request
   - Check response body for error message

---

#### Problem: "Can only have 1 Head" error
```
Error when trying to promote someone to Head
```

**Causes:**
- There's already another Head
- The promotion didn't demote the old Head

**Solutions:**
1. Check how many Heads exist:
   ```sql
   SELECT email, role FROM users WHERE role = 'head';
   ```
2. If multiple Heads, manually fix:
   ```sql
   UPDATE users 
   SET role = 'executive'
   WHERE email = 'old.head@example.com'
   AND role = 'head';
   ```
3. Try promotion again
4. Verify auto-demotion logic in API route:
   ```tsx
   // In src/app/api/admin/users/[id]/route.ts
   // Should find and demote current Head/Co-Head
   ```

---

### 4. Permission Issues

#### Problem: User has permission but can't perform action
```
Executive has "canAddEvents" but can't add events
```

**Causes:**
- Permission not actually in database
- Token doesn't include permission
- hasPermission() check is wrong
- User needs to login again for token refresh

**Solutions:**
1. Check permissions in database:
   ```sql
   SELECT email, permissions FROM users 
   WHERE email = 'user@example.com';
   ```
2. If permission missing, add it:
   ```sql
   UPDATE users 
   SET permissions = permissions || '{"canAddEvents"}'
   WHERE email = 'user@example.com';
   ```
3. User must login again to refresh token:
   ```javascript
   // Old token doesn't have new permission
   // User needs to logout and login
   localStorage.removeItem("fmc-auth-token");
   // Navigate to /login
   ```
4. Check hasPermission() logic:
   ```tsx
   // In src/lib/rbac.ts
   // Head/Co-Head should return true immediately
   // Executives check permissions array
   ```

---

#### Problem: "You don't have permission" error
```
User tries to add event but gets permission denied
```

**Causes:**
- User is Executive without canAddEvents
- User is Member (read-only)
- Middleware is too strict

**Solutions:**
1. Check user role and permissions:
   ```javascript
   const payload = JSON.parse(atob(token.split(".")[1]));
   console.log(payload.role, payload.permissions);
   ```
2. Grant permission via admin panel:
   - Go to /admin
   - Click on user "Permissions"
   - Check "Add Events"
   - Click "Save Permissions"
3. User must login again for new permissions
4. Check middleware is using right permission:
   ```tsx
   const user = await requirePermission(request, Permission.CAN_ADD_EVENTS);
   // Permission.CAN_ADD_EVENTS = "canAddEvents"
   ```

---

### 5. Database Issues

#### Problem: Database table doesn't exist
```
Error: "relation 'users' does not exist"
```

**Causes:**
- DATABASE_SCHEMA.sql not run
- Wrong database/schema

**Solutions:**
1. Copy entire DATABASE_SCHEMA.sql
2. Go to Supabase dashboard → SQL Editor
3. Create new query
4. Paste entire file
5. Click "Run"
6. Check for errors
7. Verify table exists:
   ```sql
   SELECT * FROM users;
   ```

---

#### Problem: Permissions column is wrong type
```
Error when inserting permissions: invalid array format
```

**Causes:**
- Column type is wrong (should be TEXT[])
- Database schema wasn't created correctly

**Solutions:**
1. Check column type:
   ```sql
   \d users;  -- In psql
   -- Or in Supabase: look at table structure
   ```
2. Should show: `permissions | text[]`
3. If wrong, delete table and re-run schema:
   ```sql
   DROP TABLE IF EXISTS users CASCADE;
   DROP TABLE IF EXISTS role_audit_log CASCADE;
   -- Then paste DATABASE_SCHEMA.sql
   ```

---

#### Problem: Can't insert users
```
Error: "id is not a valid UUID"
```

**Causes:**
- Not using gen_random_uuid()
- Pasting invalid UUID

**Solutions:**
1. Always use gen_random_uuid():
   ```sql
   INSERT INTO users (id, email, role, permissions)
   VALUES (
     gen_random_uuid(),  -- ← This function
     'user@example.com',
     'executive',
     '{}'
   );
   ```
2. To get UUID in JavaScript:
   ```javascript
   // Use: crypto.randomUUID() or a library
   // Or let database generate it
   ```

---

### 6. Token Issues

#### Problem: Token expired immediately
```
Token shows exp in past
```

**Causes:**
- JWT_EXPIRY_DAYS is 0 or very small
- System clock is wrong
- Token created with wrong timestamp

**Solutions:**
1. Check environment:
   ```dotenv
   JWT_EXPIRY_DAYS="30"  # Should be > 0
   ```
2. Check system clock:
   ```javascript
   new Date();  // Should be current time
   ```
3. Check token creation logic:
   ```tsx
   // In src/lib/jwt.ts
   const exp = now + TOKEN_EXPIRY_DAYS * 24 * 60 * 60;
   // exp should be timestamp + seconds
   ```

---

#### Problem: "Invalid or expired token" even though it's new
```
Token created but immediately invalid
```

**Causes:**
- JWT_SECRET doesn't match
- Signature verification is failing
- Token is malformed

**Solutions:**
1. Check JWT_SECRET:
   ```
   .env.local: JWT_SECRET="abc123"
   jwt.ts: const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"
   // Must match!
   ```
2. Verify signature algorithm:
   - Login page creates token
   - API route verifies token
   - Both must use same secret
3. Restart dev server after changing .env

---

### 7. API Route Issues

#### Problem: 404 Not Found on API route
```
GET /api/admin/users returns 404
```

**Causes:**
- File path is wrong
- Route file doesn't exist
- File name is wrong

**Solutions:**
1. Check file exists:
   ```
   src/app/api/admin/users/route.ts
   ```
2. Check file exports correct function:
   ```tsx
   export async function GET(request) { ... }
   ```
3. Correct file structure:
   ```
   /api/admin/users/route.ts → GET /api/admin/users
   /api/admin/users/[id]/route.ts → PATCH /api/admin/users/[id]
   /api/admin/users/[id]/permissions.ts → POST /api/admin/users/[id]/permissions
   ```

---

#### Problem: 401 Unauthorized on API route
```
Even with token, get 401 error
```

**Causes:**
- Authorization header not sent
- Header format is wrong
- Token is invalid

**Solutions:**
1. Check request includes header:
   ```javascript
   fetch(url, {
     headers: {
       "Authorization": `Bearer ${token}`  // Bearer + space + token
     }
   })
   ```
2. Check header format in server:
   ```tsx
   const header = request.headers.get("authorization");
   const token = header?.replace(/^Bearer\s+/i, "").trim();
   ```
3. Verify token is valid:
   ```javascript
   const payload = verifyJWT(token);
   // Should not return null
   ```

---

#### Problem: 403 Forbidden on route
```
Get 403 even though user is authenticated
```

**Causes:**
- User role is wrong
- User doesn't have permission
- Middleware check is too strict

**Solutions:**
1. Check user role:
   ```javascript
   JSON.parse(atob(token.split(".")[1])).role
   ```
2. Check route requirement:
   ```tsx
   // If requireSupremeAdmin, user must be Head/Co-Head
   // If requirePermission, user must have permission
   ```
3. Verify middleware allows user:
   ```tsx
   // Add console.log to see what's happening
   console.log("User role:", user.role);
   console.log("User permissions:", user.permissions);
   ```

---

### 8. Deployment Issues

#### Problem: Works locally but not on production
```
RBAC works in dev but fails on deployed site
```

**Causes:**
- JWT_SECRET not set in production
- Database connection wrong
- Environment variables missing

**Solutions:**
1. Verify environment variables on production:
   - Check that JWT_SECRET is set
   - Check Supabase credentials
   - Check that no variables are missing
2. Check database connection from production
3. Review Vercel/deployment provider logs
4. Test login endpoint:
   ```
   POST https://yoursite.com/api/auth/login
   { "email": "test@example.com" }
   ```

---

#### Problem: "Service misconfigured" error
```
Error: "Service misconfigured: [something] missing"
```

**Causes:**
- Environment variables not set
- Database credentials wrong

**Solutions:**
1. Check .env.local has all variables:
   ```
   JWT_SECRET=...
   JWT_EXPIRY_DAYS=...
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
2. Check production environment variables
3. Restart server after changing .env
4. Test each variable is accessible

---

### 9. Testing Issues

#### Problem: Can't test with different users
```
When testing different roles, can't login as them
```

**Solutions:**
1. Create test users in database:
   ```sql
   INSERT INTO users (id, email, role, permissions) VALUES
   (gen_random_uuid(), 'head@test.com', 'head', '{}'),
   (gen_random_uuid(), 'chead@test.com', 'co_head', '{}'),
   (gen_random_uuid(), 'exec@test.com', 'executive', '{"canAddEvents"}'),
   (gen_random_uuid(), 'member@test.com', 'member', '{}'),
   (gen_random_uuid(), 'inactive@test.com', 'inactive', '{}');
   ```
2. Use different browsers or incognito windows
3. Or use browser DevTools to manage localStorage

---

### 10. Performance Issues

#### Problem: Admin panel is slow
```
UserManagementPanel takes a long time to load
```

**Causes:**
- Too many users to load
- Database query is slow
- Network is slow

**Solutions:**
1. Add pagination to users list:
   ```tsx
   // In UserManagementPanel.tsx
   const [page, setPage] = useState(0);
   const limit = 10;
   ```
2. Optimize database query:
   ```sql
   CREATE INDEX idx_users_role ON users(role);
   ```
3. Check network speed:
   - F12 → Network tab
   - Look at request time
   - Should be < 1 second

---

## Quick Diagnostic Checklist

Use this when something breaks:

- [ ] Can user login?
  - [ ] Email exists in database?
  - [ ] User is not inactive?
  - [ ] Token created successfully?
  - [ ] Token stored in localStorage?

- [ ] Is token valid?
  - [ ] Paste in jwt.io and check payload
  - [ ] Check exp hasn't passed
  - [ ] Check role and permissions are there

- [ ] Can API routes be called?
  - [ ] Is Authorization header sent?
  - [ ] Is header format correct (Bearer ...)?
  - [ ] Is token valid?

- [ ] Does user have right access?
  - [ ] Is user role correct?
  - [ ] Does user have required permission?
  - [ ] Is middleware check correct?

- [ ] Is database correct?
  - [ ] users table exists?
  - [ ] Table has all columns?
  - [ ] Data is inserted correctly?

---

## Emergency Procedures

### Locked Out - Can't Login as Head

1. Use Supabase dashboard to create/fix Head user:
   ```sql
   UPDATE users SET role = 'head' WHERE email = 'someone@example.com';
   ```

2. Or create new Head:
   ```sql
   INSERT INTO users (id, email, role, permissions)
   VALUES (gen_random_uuid(), 'newhead@club.com', 'head', '{}');
   ```

### All Permissions Broken

1. Clear all tokens:
   ```javascript
   localStorage.removeItem("fmc-auth-token");
   // All users must login again
   ```

2. Reset token expiry to force new tokens:
   - Change JWT_EXPIRY_DAYS to 0
   - Users will get new tokens on next login
   - Change back to 30

### Database Is Corrupted

1. Backup current data
2. Recreate from DATABASE_SCHEMA.sql:
   ```sql
   DROP TABLE users CASCADE;
   DROP TABLE role_audit_log CASCADE;
   -- Paste DATABASE_SCHEMA.sql
   ```

---

**Still stuck?**

1. Check browser console (F12)
2. Check server logs
3. Review the exact error message
4. Search this guide
5. Re-read relevant documentation
6. Ask for help with exact error message
