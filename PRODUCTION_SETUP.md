# Production Setup Guide - User Management

## Overview
The POS system authentication now uses Supabase database for storing users instead of hardcoded dummy data. This guide explains how to set up users in production.

## Step 1: Create Users Table in Supabase

1. Go to your Supabase Dashboard
2. Open the SQL Editor
3. Copy the SQL from `sql/create-users-table.sql`
4. Run the SQL query

OR manually create the table:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password_hash VARCHAR(255),
  role VARCHAR(50) DEFAULT 'cashier',
  active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(active);
```

## Step 2: Generate Password Hashes

Before adding users, generate bcrypt hashes for passwords:

```bash
node scripts/generate-hash.js yourpassword
```

This will output:
```
Password: yourpassword
Hash: $2b$10$...
```

**Example:** Generate hashes for demo users:
```bash
node scripts/generate-hash.js admin123
# Output: $2b$10$nUkzalGSIEpOcocL.9nzJ.mSLjfQxMkeXZkSmOolXmqhG7C0RkLAu

node scripts/generate-hash.js cashier123
# Output: $2b$10$K8mATRlXXr2VQJL0L2R5yuN1XzX3XQJL0L2R5yuN1XzX3XQJL0L2R5y
```

## Step 3: Add Users to Database

### Option A: Using SQL Editor (Recommended)

1. Go to Supabase SQL Editor
2. Run this query:

```sql
-- Add Admin User
INSERT INTO users (email, name, role, password_hash, active)
VALUES (
  'admin@yourdomain.com',
  'Admin User',
  'admin',
  '$2b$10$nUkzalGSIEpOcocL.9nzJ.mSLjfQxMkeXZkSmOolXmqhG7C0RkLAu',
  true
)
ON CONFLICT (email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP;

-- Add Cashier User
INSERT INTO users (email, name, role, password_hash, active)
VALUES (
  'cashier@yourdomain.com',
  'Cashier User',
  'cashier',
  '$2b$10$K8mATRlXXr2VQJL0L2R5yuN1XzX3XQJL0L2R5yuN1XzX3XQJL0L2R5y',
  true
)
ON CONFLICT (email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP;
```

### Option B: Using Supabase UI

1. Open Supabase Dashboard
2. Go to "users" table
3. Click "Insert row"
4. Fill in:
   - **email**: admin@yourdomain.com
   - **name**: Admin User
   - **role**: admin
   - **password_hash**: (paste hash from step 2)
   - **active**: checked (true)
5. Repeat for other users

## Step 4: Update Environment Variables

Make sure these are set in your `.env` file:

```env
NEXT_PUBLIC_POS_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_POS_SUPABASE_ANON_KEY=your_anon_key
JWT_SECRET=your-production-secret-key-minimum-32-characters
```

> ⚠️ **SECURITY:** Change JWT_SECRET to a strong random string in production!

## Step 5: Deploy to Production

```bash
npm run build
npm start
```

## Managing Users in Production

### Add a New User

1. Generate password hash:
```bash
node scripts/generate-hash.js newpassword
```

2. Add to Supabase using SQL:
```sql
INSERT INTO users (email, name, role, password_hash, active)
VALUES (
  'newuser@domain.com',
  'New User Name',
  'cashier',
  '$2b$10$...',
  true
);
```

### Change User Password

1. Generate new password hash
2. Update in Supabase:
```sql
UPDATE users
SET password_hash = '$2b$10$...',
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'user@domain.com';
```

### Disable User

```sql
UPDATE users
SET active = false,
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'user@domain.com';
```

### Delete User

```sql
DELETE FROM users
WHERE email = 'user@domain.com';
```

### List All Users

```sql
SELECT id, email, name, role, active, last_login
FROM users
ORDER BY created_at DESC;
```

## Roles Available

- **admin**: Full access to all features (dashboard, POS, products, transactions, settings)
- **cashier**: Limited access (POS & transactions only)

Can extend with more roles as needed.

## Security Checklist

- ✅ Use strong passwords (minimum 12 characters)
- ✅ Use strong JWT_SECRET in production
- ✅ Never commit passwords or hashes to git
- ✅ Use HTTPS only in production
- ✅ Regularly rotate passwords
- ✅ Disable inactive users
- ✅ Monitor last_login for activity tracking

## Troubleshooting

### Login returns "Invalid email or password"
- Check email exists in users table
- Verify password_hash was generated correctly
- Ensure user has `active = true`

### Email already exists error
- Check if user already exists: `SELECT * FROM users WHERE email = 'email@domain.com';`
- Update existing user: Use ON CONFLICT clause or UPDATE query

### JWT token not working
- Verify JWT_SECRET matches between `.env` and code
- Check token hasn't expired (valid for 24 hours)
- Clear localStorage and login again

## Demo Credentials (Development Only)

| Email | Password | Role |
|-------|----------|------|
| admin@pos.com | admin123 | admin |
| cashier@pos.com | cashier123 | cashier |

⚠️ **Change these before going to production!**
