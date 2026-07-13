-- Add Stripe payment support to transactions

ALTER TABLE IF EXISTS transactions
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed';

ALTER TABLE IF EXISTS transactions
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

UPDATE transactions
SET status = 'completed'
WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_session_id ON transactions(stripe_session_id);