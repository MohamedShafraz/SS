-- Create users table for production
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password_hash VARCHAR(255),              -- Hashed password
  role VARCHAR(50) DEFAULT 'cashier',     -- admin, manager, cashier
  active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for email lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

-- Add initial users (replace the password hashes with actual bcrypt hashes from your generation)
-- To generate hashes, use: node scripts/generate-hash.js yourpassword

-- Admin user (password: admin123 - hash below is example, generate your own)
INSERT INTO users (email, name, role, password_hash, active)
VALUES (
  'admin@pos.com',
  'Admin User',
  'admin',
  '$2b$10$nUkzalGSIEpOcocL.9nzJ.mSLjfQxMkeXZkSmOolXmqhG7C0RkLAu',
  true
)
ON CONFLICT (email) DO NOTHING;

-- Cashier user (password: cashier123 - hash below is example, generate your own)
INSERT INTO users (email, name, role, password_hash, active)
VALUES (
  'cashier@pos.com',
  'Cashier User',
  'cashier',
  '$2b$10$K8mATRlXXr2VQJL0L2R5yuN1XzX3XQJL0L2R5yuN1XzX3XQJL0L2R5y',
  true
)
ON CONFLICT (email) DO NOTHING;
