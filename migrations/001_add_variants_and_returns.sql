-- 1. Product Variants Table
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_type VARCHAR(50) NOT NULL,           -- 'size', 'color', etc.
  variant_value VARCHAR(100) NOT NULL,         -- e.g., 'M', 'Large', 'Red'
  sku VARCHAR(50) UNIQUE,                      -- Variant-specific SKU
  barcode VARCHAR(50) UNIQUE,                  -- Variant-specific barcode
  quantity INT DEFAULT 0,                      -- Stock for this variant
  price_adjustment DECIMAL(10, 2) DEFAULT 0,   -- Additional cost for this variant
  image_url TEXT,                              -- Variant-specific image (base64 or URL)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_barcode ON product_variants(barcode);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_variants_type_value ON product_variants(variant_type, variant_value);

-- ============================================================
-- PHASE 1: Add Returns & Replacements Support
-- ============================================================

-- 2. Returns Table
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  return_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason VARCHAR(255),                         -- e.g., 'Wrong size', 'Damaged', 'Changed mind'
  notes TEXT,                                  -- Additional notes
  status VARCHAR(50) DEFAULT 'pending',        -- pending, completed, cancelled
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_returns_transaction ON returns(original_transaction_id);
CREATE INDEX IF NOT EXISTS idx_returns_date ON returns(return_date);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);

-- 3. Return Items Table (items being returned)
CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),  -- Optional: if product has variants
  quantity INT NOT NULL,
  refund_amount DECIMAL(10, 2) NOT NULL,       -- Original price × quantity
  status VARCHAR(50) DEFAULT 'pending',        -- pending, completed, cancelled
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_return_items_product ON return_items(product_id);

-- 4. Replacement Items Table (items customer is taking instead)
CREATE TABLE IF NOT EXISTS replacement_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),  -- Optional
  quantity INT NOT NULL,
  replacement_price DECIMAL(10, 2) NOT NULL,  -- Price of replacement item
  status VARCHAR(50) DEFAULT 'pending',        -- pending, completed, cancelled
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_replacement_items_return ON replacement_items(return_id);
CREATE INDEX IF NOT EXISTS idx_replacement_items_product ON replacement_items(product_id);

-- ============================================================
-- Update Transactions Table to support replacements
-- ============================================================

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS is_replacement_transaction BOOLEAN DEFAULT FALSE;

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS original_return_id UUID REFERENCES returns(id);

CREATE INDEX IF NOT EXISTS idx_transactions_is_replacement ON transactions(is_replacement_transaction);
CREATE INDEX IF NOT EXISTS idx_transactions_return_id ON transactions(original_return_id);
