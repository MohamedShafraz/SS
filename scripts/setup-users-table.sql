-- Create users table for authentication
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'cashier',
  active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

-- Insert demo users (passwords are hashed with bcrypt)
-- Admin: admin@pos.com / admin123
-- Cashier: cashier@pos.com / cashier123
INSERT INTO users (email, name, password_hash, role, active) VALUES
  ('admin@pos.com', 'Admin User', '$2b$10$nUkzalGSIEpOcocL.9nzJ.mSLjfQxMkeXZkSmOolXmqhG7C0RkLAu', 'admin', true),
  ('cashier@pos.com', 'Cashier User', '$2b$10$nUkzalGSIEpOcocL.9nzJ.mSLjfQxMkeXZkSmOolXmqhG7C0RkLAu', 'cashier', true)
ON CONFLICT DO NOTHING;
