// ============================================================
// EXISTING TYPES (keep as is)
// ============================================================

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  quantity: number;
  image_url: string;
  barcode: string;
  sku: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  transaction_date: string;
  items: TransactionItem[];
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  payment_method: string;
  user_id: string;
  created_at: string;
  is_replacement_transaction?: boolean;      // NEW: marks if this is a replacement
  original_return_id?: string;                // NEW: links to original return
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
}

export interface Discount {
  id: string;
  type: "product" | "category" | "bundle";
  name: string;
  percentage: number;
  amount: number;
  products: string[];
  categories: string[];
  active: boolean;
  created_at: string;
}

export interface DashboardMetrics {
  total_sales: number;
  total_purchases: number;
  profit: number;
  loss: number;
  inventory_value: number;
  products_count: number;
  transactions_count: number;
  date_range: {
    start: string;
    end: string;
  };
}

// ============================================================
// NEW TYPES FOR VARIANTS & RETURNS (Phase 1)
// ============================================================

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_type: string;              // 'size', 'color', etc.
  variant_value: string;             // 'M', 'Red', 'Large', etc.
  sku: string;
  barcode: string;
  quantity: number;
  price_adjustment: number;          // Extra cost for this variant
  created_at: string;
  updated_at: string;
}

export interface Return {
  id: string;
  original_transaction_id: string;
  return_date: string;
  reason: string;                    // 'Wrong size', 'Damaged', etc.
  notes: string;
  status: "pending" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface ReturnItem {
  id: string;
  return_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  refund_amount: number;
  status: "pending" | "completed" | "cancelled";
  created_at: string;
}

export interface ReplacementItem {
  id: string;
  return_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  replacement_price: number;
  status: "pending" | "completed" | "cancelled";
  created_at: string;
}

// Extended CartItem to support variants
export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string;
  discount?: number;
  discountType?: "lkr" | "percentage";
  variant_id?: string;               // NEW: for variant support
  variant_type?: string;             // NEW: e.g., 'size'
  variant_value?: string;            // NEW: e.g., 'M'
}
