# JWT Authentication System

## Overview
This POS system now includes JWT-based authentication with two user roles: **Admin** and **Cashier**.

## Features
- ✅ JWT token-based authentication
- ✅ Role-based access control (Admin & Cashier)
- ✅ Secure password hashing with bcrypt
- ✅ Protected routes via middleware
- ✅ Persistent login with localStorage
- ✅ Automatic logout on token expiration
- ✅ User info display in top bar

## Default Users

### Admin Account
- **Email:** `admin@pos.com`
- **Password:** `admin123`
- **Role:** Admin (full access to all features)

### Cashier Account
- **Email:** `cashier@pos.com`
- **Password:** `cashier123`
- **Role:** Cashier (limited access - POS & Transactions)

## Authentication Flow

### 1. Login Page
- User navigates to `/login`
- Enters email and password
- Credentials validated against user database

### 2. Token Generation
- Server validates password using bcrypt
- Generates JWT token (valid for 24 hours)
- Token stored in localStorage on client
- User redirected to `/dashboard`

### 3. Protected Routes
- Middleware checks for valid token on each request
- Invalid/expired tokens redirect to login
- Token verified via JWT secret

### 4. User Session
- User info (name, email, role) displayed in top bar
- Logout button clears token and redirects to login

## Files Created

### Authentication Core
- `src/lib/auth-context.tsx` - Auth context provider and useAuth hook
- `src/app/api/auth/login/route.ts` - Login API endpoint
- `middleware.ts` - Route protection middleware
- `src/app/login/page.tsx` - Login UI page

### Updated Files
- `src/app/layout.tsx` - Added AuthProvider wrapper
- `src/components/layout.tsx` - Added logout button and user info display

### Utilities
- `scripts/generate-hash.js` - Helper to generate password hashes

## Environment Variables

Add to `.env`:
```env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

> ⚠️ **IMPORTANT:** Change the JWT_SECRET in production!

## Protected Routes
- `/dashboard`
- `/pos`
- `/products`
- `/transactions`
- `/settings`

## Customizing Users

### Add a New User

1. Generate password hash:
```bash
node scripts/generate-hash.js yourpassword
```

2. Update user list in `src/app/api/auth/login/route.ts`:
```typescript
const USERS = [
  {
    id: "3",
    email: "newuser@pos.com",
    name: "New User",
    role: "cashier",
    passwordHash: "bcrypt-hash-from-above",
  },
  // ... existing users
];
```

### Change a Password

```bash
node scripts/generate-hash.js newpassword
```
Update the corresponding user's `passwordHash` in the USERS array.

## Security Notes

- ⚠️ **Production:** Store users in Supabase database instead of hardcoded list
- ⚠️ **Production:** Use a strong JWT_SECRET (minimum 32 characters)
- ⚠️ **Production:** Enable HTTPS only (secure cookies)
- ✅ **Development:** Demo credentials for testing only

## API Endpoint

### POST `/api/auth/login`

**Request:**
```json
{
  "email": "admin@pos.com",
  "password": "admin123"
}
```

**Success Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "1",
    "email": "admin@pos.com",
    "name": "Admin User",
    "role": "admin"
  }
}
```

**Error Response (401):**
```json
{
  "message": "Invalid email or password"
}
```

## Role-Based Features (Future)

Can be implemented to restrict features by role:

```typescript
// Example: Only admins can edit products
if (user.role !== "admin") {
  return <div>Access Denied</div>;
}
```

## Testing

1. Start the dev server:
```bash
npm run dev
```

2. Go to `http://localhost:3000/login`

3. Try login with:
   - **Admin:** admin@pos.com / admin123
   - **Cashier:** cashier@pos.com / cashier123

4. Test logout by clicking "Logout" in top bar

5. Verify redirect to login page after logout
