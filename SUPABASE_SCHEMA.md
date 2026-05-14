# Supabase Schema Documentation

## Database Tables

### 1. Products Table
Stores all product information.

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price INT NOT NULL,                      -- Selling price in paise
  cost INT NOT NULL,                       -- Cost price in paise
  quantity INT DEFAULT 0,                  -- Current stock quantity
  image_url TEXT,                          -- Product image URL
  barcode VARCHAR(50) UNIQUE,              -- Barcode number
  sku VARCHAR(50) UNIQUE,                  -- Stock Keeping Unit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
```sql
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_sku ON products(sku);
```

---

### 2. Transactions Table
Stores transaction summaries.

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_date DATE NOT NULL,          -- Date of transaction
  total_amount INT NOT NULL,               -- Total sale amount
  discount_amount INT DEFAULT 0,           -- Total discount given
  tax_amount INT DEFAULT 0,                -- Tax collected
  payment_method VARCHAR(50) NOT NULL,     -- Cash, Card, UPI, Check
  user_id UUID,                            -- Cashier ID (optional)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
```sql
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_user ON transactions(user_id);
```

---

### 3. Transaction Items Table
Stores individual items in each transaction.

```sql
CREATE TABLE transaction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,                   -- Quantity sold
  unit_price INT NOT NULL,                 -- Price per unit at time of sale
  discount INT DEFAULT 0,                  -- Discount amount for this item
  subtotal INT NOT NULL                    -- (unit_price * quantity) - discount
);
```

**Indexes:**
```sql
CREATE INDEX idx_transaction_items_tx ON transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_product ON transaction_items(product_id);
```

---

### 4. Discounts Table
Stores all discount rules.

```sql
CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL,               -- 'product', 'category', 'bundle'
  name VARCHAR(255) NOT NULL,              -- Discount name
  description TEXT,                        -- Discount description
  percentage FLOAT,                        -- Percentage discount (0-100)
  amount INT,                              -- Fixed amount discount (in paise)
  products TEXT[],                         -- Array of product IDs (for product discount)
  categories TEXT[],                       -- Array of category names (for category discount)
  min_quantity INT,                        -- Minimum quantity required
  active BOOLEAN DEFAULT true,             -- Is discount active
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 5. Users Table
Stores user accounts (for multi-user support).

```sql
CREATE TABLE users (
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
```

---

### 6. Categories Table
Stores product categories.

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(7),                        -- Hex color code
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Categories Data:**
```sql
INSERT INTO categories (name, color) VALUES
  ('Sports Shoes', '#FF6B6B'),
  ('School Shoes', '#4ECDC4'),
  ('Travel Bags', '#45B7D1'),
  ('School Bags', '#F7DC6F'),
  ('Slippers', '#BB8FCE'),
  ('Sandals', '#85C1E2'),
  ('Belts', '#F8B88B');
```

---

### 7. Dashboard Metrics Table (Optional)
For caching calculated metrics.

```sql
CREATE TABLE dashboard_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_date DATE NOT NULL UNIQUE,
  total_sales INT,
  total_transactions INT,
  total_profit INT,
  total_loss INT,
  inventory_value INT,
  products_count INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Sample Queries

### Get Daily Sales
```sql
SELECT 
  DATE(t.transaction_date) as date,
  COUNT(*) as transactions,
  SUM(t.total_amount) as total_sales,
  SUM(t.discount_amount) as total_discounts,
  SUM(t.tax_amount) as total_tax
FROM transactions t
WHERE DATE(t.transaction_date) >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(t.transaction_date)
ORDER BY date DESC;
```

### Get Category-wise Sales
```sql
SELECT 
  p.category,
  COUNT(ti.id) as items_sold,
  SUM(ti.quantity) as total_quantity,
  SUM(ti.subtotal) as revenue
FROM transaction_items ti
JOIN products p ON ti.product_id = p.id
JOIN transactions t ON ti.transaction_id = t.id
WHERE DATE(t.transaction_date) = CURRENT_DATE
GROUP BY p.category
ORDER BY revenue DESC;
```

### Get Profit/Loss Analysis
```sql
SELECT 
  p.name,
  SUM(ti.quantity) as items_sold,
  SUM(ti.unit_price * ti.quantity) as revenue,
  SUM(p.cost * ti.quantity) as cost,
  (SUM(ti.unit_price * ti.quantity) - SUM(p.cost * ti.quantity)) as profit
FROM transaction_items ti
JOIN products p ON ti.product_id = p.id
JOIN transactions t ON ti.transaction_id = t.id
WHERE DATE(t.transaction_date) = CURRENT_DATE
GROUP BY p.id, p.name
ORDER BY profit DESC;
```

### Get Low Stock Items
```sql
SELECT 
  id, name, category, quantity
FROM products
WHERE quantity < 10
ORDER BY quantity ASC;
```

### Get Transaction Details
```sql
SELECT 
  t.id,
  t.transaction_date,
  t.total_amount,
  t.payment_method,
  json_agg(json_build_object(
    'product', p.name,
    'quantity', ti.quantity,
    'price', ti.unit_price,
    'discount', ti.discount
  )) as items
FROM transactions t
LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
LEFT JOIN products p ON ti.product_id = p.id
WHERE t.id = 'transaction_uuid'
GROUP BY t.id;
```

---

## Indexes for Performance

```sql
-- Product indexes
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_quantity ON products(quantity);

-- Transaction indexes
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_user ON transactions(user_id);

-- Transaction items indexes
CREATE INDEX idx_transaction_items_tx ON transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_product ON transaction_items(product_id);

-- Dashboard metrics index
CREATE INDEX idx_dashboard_metrics_date ON dashboard_metrics(metric_date);
```

---

## Row Level Security (RLS) Policies (Optional)

For multi-user support:

```sql
-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

-- Policies for users to see their own data
CREATE POLICY "Users can view their transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can insert transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');
```

---

## Storage for Images

Supabase Storage bucket for product images:

```sql
-- Create storage bucket (via UI or API)
-- Bucket name: product-images
-- Public access: Yes
-- File size limit: 5MB
```

Upload example:
```typescript
const { data, error } = await supabase.storage
  .from('product-images')
  .upload(`${product_id}/${Date.now()}.jpg`, file);
```

---

## Data Types Reference

| Type | Usage | Max Value |
|------|-------|-----------|
| INT | Price, quantity (stored in paise/smallest unit) | 2,147,483,647 |
| FLOAT | Percentages | - |
| VARCHAR(n) | Names, descriptions, codes | n characters |
| TEXT | Long text, descriptions | Very large |
| TIMESTAMP | Date and time | - |
| DATE | Date only | - |
| UUID | IDs, relationships | - |
| BOOLEAN | Yes/No values | true/false |
| TEXT[] | Arrays (JSON) | - |

---

## Migration Commands

If you need to modify schema:

```bash
# Add a new column
ALTER TABLE products ADD COLUMN discount_eligible BOOLEAN DEFAULT true;

# Update existing data
UPDATE products SET discount_eligible = true WHERE category = 'Sports Shoes';

# Add constraint
ALTER TABLE products ADD CONSTRAINT positive_price CHECK (price > 0);

# Drop column
ALTER TABLE products DROP COLUMN discount_eligible;
```

---

## Backup Strategy

Regular backups are important:

1. **Automated Backups** - Supabase automatically backs up daily
2. **Manual Export** - Export via Supabase dashboard
3. **Scheduled CSV Export** - Create a cron job to export data

---

## Notes

- All prices are stored in the smallest unit (paise) to avoid floating-point errors
- Convert to display: `price / 100` for currency display
- UUIDs are used for IDs to ensure uniqueness across systems
- Timestamps are in UTC by default
