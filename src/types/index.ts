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
