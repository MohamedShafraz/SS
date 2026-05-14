-- Supabase Database Initialization Script
-- Copy and paste this entire script into the Supabase SQL Editor
-- Dashboard > SQL Editor > New Query > Paste this script > Run

-- ============================================================
-- 1. PRODUCTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,                 -- Selling price
  cost DECIMAL(10, 2) NOT NULL,                  -- Cost price
  quantity INT DEFAULT 0,                        -- Current stock quantity
  image_url TEXT,                                -- Product image (base64 or URL)
  barcode VARCHAR(50) UNIQUE,                    -- Barcode number
  sku VARCHAR(50) UNIQUE,                        -- Stock Keeping Unit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- ============================================================
-- 2. TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_date TIMESTAMP NOT NULL,          -- Date and time of transaction
  total_amount DECIMAL(10, 2) NOT NULL,         -- Total sale amount
  discount_amount DECIMAL(10, 2) DEFAULT 0,     -- Total discount given
  tax_amount DECIMAL(10, 2) DEFAULT 0,          -- Tax collected (5%)
  payment_method VARCHAR(50) NOT NULL,          -- cash, card, check, etc.
  user_id UUID,                                 -- Cashier ID (optional)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);

-- ============================================================
-- 3. TRANSACTION ITEMS TABLE (Individual items in each transaction)
-- ============================================================
CREATE TABLE IF NOT EXISTS transaction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,                        -- Quantity sold
  unit_price DECIMAL(10, 2) NOT NULL,           -- Price per unit at time of sale
  discount DECIMAL(10, 2) DEFAULT 0,            -- Discount amount for this item
  subtotal DECIMAL(10, 2) NOT NULL              -- (unit_price * quantity) - discount
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_transaction_items_tx ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product ON transaction_items(product_id);

-- ============================================================
-- 4. CATEGORIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(7),                             -- Hex color code
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories
INSERT INTO categories (name, color) VALUES
  ('Sports Shoes', '#FF6B6B'),
  ('School Shoes', '#4ECDC4'),
  ('Travel Bags', '#45B7D1'),
  ('School Bags', '#F7DC6F'),
  ('Slippers', '#BB8FCE'),
  ('Sandals', '#85C1E2'),
  ('Belts', '#F8B88B')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 5. DISCOUNTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS discounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL,                    -- 'product', 'category', 'bundle'
  name VARCHAR(255) NOT NULL,                   -- Discount name
  description TEXT,                             -- Discount description
  percentage FLOAT,                             -- Percentage discount (0-100)
  amount DECIMAL(10, 2),                        -- Fixed amount discount
  products TEXT[],                              -- Array of product IDs (for product discount)
  categories TEXT[],                            -- Array of category names (for category discount)
  min_quantity INT,                             -- Minimum quantity required
  active BOOLEAN DEFAULT true,                  -- Is discount active
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 6. USERS TABLE (For multi-user support)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password_hash VARCHAR(255),                   -- Hashed password
  role VARCHAR(50) DEFAULT 'cashier',           -- admin, manager, cashier
  active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SETUP COMPLETE
-- ============================================================
-- All tables have been created successfully!
-- You can now run the POS application and start adding products.
