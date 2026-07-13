# Setting Up Users in Supabase

This setup uses database-backed credentials. Passwords are saved as hashes in the `users` table, so you should store the plain password safely when you create or reset a user. You cannot recover the original password from the database.

## Step 1: Create Users Table

1. Go to your Supabase project dashboard
2. Click on **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the SQL from `sql/users-admin-rpc.sql`
5. Click **Run** to execute

This will:
- Create the `users` table
- Add indexes for performance
- Add admin RPC helpers for create/list/reset password
- Insert demo users with hashed passwords

## Step 2: Verify Setup

Query the users table:
```sql
SELECT id, email, name, role, active FROM users;
```

You should see:
```
| email              | name         | role    | active |
|--------------------|--------------|---------|--------|
| admin@pos.com      | Admin User   | admin   | true   |
| cashier@pos.com    | Cashier User | cashier | true   |
```

## Step 3: Test Login

1. Start the dev server: `npm run dev`
2. Go to `http://localhost:3000/login`
3. Login with:
   - **Admin:** admin@pos.com / admin123
   - **Cashier:** cashier@pos.com / cashier123

## Adding New Users

To add a new user in production:

### 1. Use the admin user screen

Go to `Settings` after signing in as an admin.

### 2. Create the user

Enter:
- Email
- Name
- Role
- Password

The system stores the password hash in the database and shows the plain credentials once, so save them immediately.

### 3. Verify in the database

```sql
SELECT id, email, name, role, active, created_at
FROM users
ORDER BY created_at DESC;
```

## Resetting Passwords

Use the admin settings screen to reset the password for an existing user. The new password will be hashed and stored in the database.

If you need to do it manually in SQL, run:

```sql
select admin_reset_user_password('user@pos.com', 'NewStrongPassword123');
```

## Deactivating Users

```sql
UPDATE users SET active = false WHERE email = 'user@pos.com';
```

## Deleting Users

```sql
DELETE FROM users WHERE email = 'user@pos.com';
```

## Demo User Passwords

| Email | Password | Role |
|-------|----------|------|
| admin@pos.com | admin123 | Admin |
| cashier@pos.com | cashier123 | Cashier |

---

## Password Hashes Reference

These hashes correspond to the passwords shown above:

```
Hash: $2b$10$nUkzalGSIEpOcocL.9nzJ.mSLjfQxMkeXZkSmOolXmqhG7C0RkLAu
Password: admin123
Password: cashier123
```

Both demo users use the same password (admin123 / cashier123). You can change them individually using the reset process above.

## Security Notes

⚠️ **Important for Production:**
1. Change demo user passwords immediately
2. Use strong, unique passwords (minimum 12 characters)
3. Store JWT_SECRET securely in environment variables
4. Keep the user creation and password reset actions restricted to admin users in the app
5. Use HTTPS only in production

## Troubleshooting

### 401 Error on Login
- Check if users table exists: `SELECT * FROM users;`
- Verify user email exists: `SELECT * FROM users WHERE email = 'admin@pos.com';`
- Check password hash format: `SELECT password_hash FROM users LIMIT 1;`

### Password Verification Fails
- Ensure password hash starts with `$2b$10$` or `$2a$10$`
- Regenerate hash using: `node scripts/generate-hash.js`
- Update user in database with new hash

### User Not Found
- Verify `active` column is `true`
- Check email is exact match (case-sensitive in some databases)
- Ensure row was inserted successfully
