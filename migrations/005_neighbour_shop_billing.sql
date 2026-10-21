-- Adds neighbour shop billing, receivables, and follow-up payment tracking.

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sale_type VARCHAR(50) DEFAULT 'walk_in';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'paid';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS due_amount DECIMAL(10, 2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS shop_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(100),
  address TEXT,
  notes TEXT,
  total_billed DECIMAL(10, 2) DEFAULT 0,
  total_paid DECIMAL(10, 2) DEFAULT 0,
  due_amount DECIMAL(10, 2) DEFAULT 0,
  payment_status VARCHAR(50) DEFAULT 'unpaid',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shop_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shop_accounts(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  amount DECIMAL(10, 2) DEFAULT 0,
  payment_method VARCHAR(50) DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_shop ON transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_shop_payments_shop ON shop_payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_payments_transaction ON shop_payments(transaction_id);
