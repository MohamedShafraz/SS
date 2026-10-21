// ============================================================
// EXISTING TYPES (keep as is)
// ============================================================

export type IndustryMode =
  | "general"
  | "sports"
  | "mechanical"
  | "medical"
  | "fashion"
  | "electronics"
  | "grocery";

export type AuthRole = "admin" | "manager" | "cashier";
export type ReturnStatus = "pending" | "completed" | "cancelled";
export type TransactionStatus = "pending" | "completed" | "cancelled";
export type SaleType = "walk_in" | "shop";
export type PaymentStatus = "paid" | "partial" | "unpaid";
export type PosSetPriceRule = "least_price" | "cost" | "below_cost";
export type BarcodeStickerFieldId =
  | "businessName"
  | "businessAddress"
  | "businessPhone"
  | "productName"
  | "barcodeImage"
  | "barcodeText"
  | "sellingPrice"
  | "leastPrice"
  | "leastPriceCode";
export type BarcodeStickerFieldAlignment = "left" | "center" | "right";
export type BarcodePdfViewerId = "system" | "adobe" | "edge" | "chrome" | "firefox";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: AuthRole;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  message?: string;
}

export interface BusinessProfile {
  businessName: string;
  address: string;
  phone: string;
  email: string;
  taxRate: number;
  currency: string;
  businessType: string;
  barcodePrefix: string;
  barcodeUsePrefix?: boolean;
  barcodeDigitLength?: number;
  industryMode: IndustryMode;
  receiptLayout?: "compact" | "standard" | "detailed";
  receiptPaperWidth?: "58mm" | "80mm";
  showReceiptBusinessInfo?: boolean;
  logoImage?: string;
  showReceiptFooter?: boolean;
  receiptFooterMode?: "return_days" | "valid_days" | "custom";
  receiptFooterDays?: number;
  receiptFooterText?: string;
  barcodeStickerPresetId?: string;
  barcodeStickerCustomPresets?: BarcodeStickerPreset[];
  barcodePdfViewerEnabledIds?: BarcodePdfViewerId[];
  barcodePdfViewerPreferredId?: BarcodePdfViewerId;
  autoBackupEnabled?: boolean;
  autoBackupFolderPath?: string;
  autoBackupLastRunAt?: string;
  autoBackupLastStatus?: "success" | "skipped" | "error" | "";
  autoBackupLastMessage?: string;
  autoBackupLastPath?: string;
  allowTransactionDelete?: boolean;
  posSetPriceRule?: PosSetPriceRule;
  billBarcodeEnabled?: boolean;
  returnBarcodeEnabled?: boolean;
  replacementBarcodeEnabled?: boolean;
  replacementStockProtectionEnabled?: boolean;
  partialReturnProtectionEnabled?: boolean;
  taxCalculationEnabled?: boolean;
  transactionFiltersEnabled?: boolean;
  reportExportsEnabled?: boolean;
  backupRestoreAdminOnlyEnabled?: boolean;
  shopBillingEnabled?: boolean;
  shopDashboardReceivablesEnabled?: boolean;
  shopDashboardPartialBillsEnabled?: boolean;
  shopDashboardUnpaidBillsEnabled?: boolean;
  shopDashboardFollowupPaymentsEnabled?: boolean;
  shopDashboardFollowupTableEnabled?: boolean;
}

export interface BarcodeStickerPreset {
  id: string;
  name: string;
  builtIn?: boolean;
  stickerWidthMm: number;
  stickerHeightMm: number;
  columns: number;
  rows: number;
  maxRollLengthMm: number;
  columnGapMm: number;
  rowGapMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  barcodeHeightMm: number;
  barcodeBarWidth: number;
  orientation?: "horizontal" | "vertical";
  productNameFontSize: number;
  sellingPriceFontSize: number;
  leastPriceFontSize: number;
  leastPriceCodeFontSize: number;
  barcodeTextFontSize?: number;
  businessInfoFontSize: number;
  businessAddressFontSize?: number;
  businessPhoneFontSize?: number;
  fieldOrder?: BarcodeStickerFieldId[];
  fieldGapsMm?: Partial<Record<BarcodeStickerFieldId, number>>;
  fieldAlignments?: Partial<Record<BarcodeStickerFieldId, BarcodeStickerFieldAlignment>>;
  showProductName: boolean;
  showSellingPrice: boolean;
  showLeastPrice: boolean;
  showLeastPriceCode: boolean;
  showBarcodeText: boolean;
  showBusinessName: boolean;
  showBusinessAddress: boolean;
  showBusinessPhone: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  least_price?: number;
  least_price_code?: string;
  company_id?: string | null;
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
  amount_paid?: number | null;
  balance_amount?: number | null;
  payment_method: string;
  status?: TransactionStatus;
  stripe_session_id?: string | null;
  user_id: string | null;
  created_at: string;
  is_replacement_transaction?: boolean;      // NEW: marks if this is a replacement
  original_return_id?: string | null;         // NEW: links to original return
  shop_id?: string | null;
  customer_name?: string | null;
  sale_type?: SaleType | null;
  payment_status?: PaymentStatus | null;
  due_amount?: number | null;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string;
  variant_id?: string | null;
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
  variant_type_2?: string | null;     // Optional second attribute, e.g., 'color'
  variant_value_2?: string | null;    // Optional second value, e.g., 'Red'
  sku: string;
  barcode: string;
  quantity: number;
  price_adjustment: number;          // Extra cost for this variant
  least_price?: number | null;       // Informational shop reference
  least_price_code?: string | null;  // Informational shop reference code
  image_url?: string | null;         // NEW: variant-specific image
  created_at: string;
  updated_at: string;
}

export interface Return {
  id: string;
  original_transaction_id: string;
  return_date: string;
  reason: string | null;             // 'Wrong size', 'Damaged', etc.
  notes: string | null;
  status: ReturnStatus;
  created_at: string;
  updated_at: string | null;
}

export interface ReturnItem {
  id: string;
  return_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  refund_amount: number;
  status: ReturnStatus;
  created_at: string;
}

export interface ReplacementItem {
  id: string;
  return_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  replacement_price: number;
  status: ReturnStatus;
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

export interface ProductRow {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  least_price: number | null;
  least_price_code: string | null;
  company_id: string | null;
  quantity: number;
  image_url: string;
  barcode: string;
  sku: string;
  created_at: string;
  updated_at: string;
}

export type ProductInsert = Pick<ProductRow, "name" | "category" | "price" | "cost"> &
  Partial<Pick<ProductRow, "id" | "quantity" | "least_price" | "least_price_code" | "created_at" | "updated_at">> & {
  image_url?: string | null;
  barcode?: string;
  sku?: string;
};

export interface NullableProductRow extends Omit<ProductRow, "quantity" | "image_url" | "barcode" | "sku" | "created_at" | "updated_at"> {
  quantity: number | null;
  image_url: string | null;
  barcode: string | null;
  sku: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type NullableProductInsert = Omit<NullableProductRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export interface ProductVariantRow {
  id: string;
  product_id: string;
  variant_type: string;
  variant_value: string;
  variant_type_2: string | null;
  variant_value_2: string | null;
  sku: string;
  barcode: string;
  quantity: number;
  price_adjustment: number;
  least_price: number | null;
  least_price_code: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductVariantInsert = Omit<ProductVariantRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export interface TransactionRow {
  id: string;
  transaction_date: string;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  amount_paid: number | null;
  balance_amount: number | null;
  payment_method: string;
  status: TransactionStatus | null;
  stripe_session_id: string | null;
  user_id: string | null;
  created_at: string | null;
  is_replacement_transaction: boolean | null;
  original_return_id: string | null;
  shop_id: string | null;
  customer_name: string | null;
  sale_type: SaleType | null;
  payment_status: PaymentStatus | null;
  due_amount: number | null;
}

export interface ShopAccountRow {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  total_billed: number;
  total_paid: number;
  due_amount: number;
  payment_status: PaymentStatus;
  created_at: string | null;
  updated_at: string | null;
}

export interface ShopPaymentRow {
  id: string;
  shop_id: string;
  transaction_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  created_at: string | null;
}

export interface SupplierRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  products: string | null;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  payment_status: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface SupplierPaymentRow {
  id: string;
  supplier_id: string;
  payment_date: string;
  amount: number;
  notes: string | null;
  created_at: string | null;
}

export interface ExpenseRow {
  id: string;
  expense_date: string;
  category: "staff_salary" | "daily" | "other" | string;
  description: string | null;
  amount: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface CompanyRow {
  id: string;
  name: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type TransactionInsert = Pick<
  TransactionRow,
  "transaction_date" | "total_amount" | "discount_amount" | "tax_amount" | "payment_method"
> &
  Partial<
    Pick<
      TransactionRow,
      | "id"
      | "status"
      | "stripe_session_id"
      | "user_id"
      | "created_at"
      | "amount_paid"
      | "balance_amount"
      | "is_replacement_transaction"
      | "original_return_id"
      | "shop_id"
      | "customer_name"
      | "sale_type"
      | "payment_status"
      | "due_amount"
    >
  >;

export interface TransactionItemRow {
  id: string;
  transaction_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
}

export type TransactionItemWithProductRow = TransactionItemRow & {
  products: Pick<ProductRow, "name" | "image_url"> | null;
};

export interface ReturnRow {
  id: string;
  original_transaction_id: string;
  return_date: string;
  reason: string | null;
  notes: string | null;
  status: ReturnStatus | null;
  created_at: string | null;
  updated_at: string | null;
}

export type ReturnInsert = Omit<ReturnRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export interface ReturnItemRow {
  id: string;
  return_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  refund_amount: number;
  status: ReturnStatus | null;
  created_at: string | null;
}

export type ReturnItemInsert = Omit<ReturnItemRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export interface ReplacementItemRow {
  id: string;
  return_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  replacement_price: number;
  status: ReturnStatus | null;
  created_at: string | null;
}

export type ReplacementItemInsert = Omit<ReplacementItemRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  role: AuthRole | null;
  active: boolean | null;
  last_login: string | null;
  created_at: string | null;
  updated_at: string | null;
  password_reset_token_hash?: string | null;
  password_reset_expires_at?: string | null;
}

export interface PlanPurchaseRow {
  id: string;
  plan_name: string;
  amount: number;
  currency: string | null;
  status: string | null;
  stripe_session_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  password_hash: string | null;
  user_role: AuthRole | null;
  user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type PlanPurchaseInsert = Omit<PlanPurchaseRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export interface Database {
  public: {
    Tables: {
      products: {
        Row: ProductRow & Record<string, unknown>;
        Insert: ProductInsert & Record<string, unknown>;
        Update: Partial<ProductInsert> & Record<string, unknown>;
        Relationships: [];
      };
      product_variants: {
        Row: ProductVariantRow & Record<string, unknown>;
        Insert: ProductVariantInsert & Record<string, unknown>;
        Update: Partial<ProductVariantInsert> & Record<string, unknown>;
        Relationships: [];
      };
      transactions: {
        Row: TransactionRow & Record<string, unknown>;
        Insert: TransactionInsert & Record<string, unknown>;
        Update: Partial<TransactionInsert> & Record<string, unknown>;
        Relationships: [];
      };
      transaction_items: {
        Row: TransactionItemRow & Record<string, unknown>;
        Insert: Omit<TransactionItemRow, "id"> & { id?: string } & Record<string, unknown>;
        Update: Partial<Omit<TransactionItemRow, "id">> & Record<string, unknown>;
        Relationships: [];
      };
      returns: {
        Row: ReturnRow & Record<string, unknown>;
        Insert: ReturnInsert & Record<string, unknown>;
        Update: Partial<ReturnInsert> & Record<string, unknown>;
        Relationships: [];
      };
      return_items: {
        Row: ReturnItemRow & Record<string, unknown>;
        Insert: ReturnItemInsert & Record<string, unknown>;
        Update: Partial<ReturnItemInsert> & Record<string, unknown>;
        Relationships: [];
      };
      replacement_items: {
        Row: ReplacementItemRow & Record<string, unknown>;
        Insert: ReplacementItemInsert & Record<string, unknown>;
        Update: Partial<ReplacementItemInsert> & Record<string, unknown>;
        Relationships: [];
      };
      users: {
        Row: UserRow & Record<string, unknown>;
        Insert: Omit<UserRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        } & Record<string, unknown>;
        Update: Partial<Omit<UserRow, "id">> & Record<string, unknown>;
        Relationships: [];
      };
      suppliers: {
        Row: SupplierRow & Record<string, unknown>;
        Insert: Omit<SupplierRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        } & Record<string, unknown>;
        Update: Partial<Omit<SupplierRow, "id">> & Record<string, unknown>;
        Relationships: [];
      };
      shop_accounts: {
        Row: ShopAccountRow & Record<string, unknown>;
        Insert: Omit<ShopAccountRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        } & Record<string, unknown>;
        Update: Partial<Omit<ShopAccountRow, "id">> & Record<string, unknown>;
        Relationships: [];
      };
      shop_payments: {
        Row: ShopPaymentRow & Record<string, unknown>;
        Insert: Omit<ShopPaymentRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        } & Record<string, unknown>;
        Update: Partial<Omit<ShopPaymentRow, "id">> & Record<string, unknown>;
        Relationships: [];
      };
      supplier_payments: {
        Row: SupplierPaymentRow & Record<string, unknown>;
        Insert: Omit<SupplierPaymentRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        } & Record<string, unknown>;
        Update: Partial<Omit<SupplierPaymentRow, "id">> & Record<string, unknown>;
        Relationships: [];
      };
      expenses: {
        Row: ExpenseRow & Record<string, unknown>;
        Insert: Omit<ExpenseRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        } & Record<string, unknown>;
        Update: Partial<Omit<ExpenseRow, "id">> & Record<string, unknown>;
        Relationships: [];
      };
      companies: {
        Row: CompanyRow & Record<string, unknown>;
        Insert: Omit<CompanyRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        } & Record<string, unknown>;
        Update: Partial<Omit<CompanyRow, "id">> & Record<string, unknown>;
        Relationships: [];
      };
      plan_purchases: {
        Row: PlanPurchaseRow & Record<string, unknown>;
        Insert: PlanPurchaseInsert & Record<string, unknown>;
        Update: Partial<PlanPurchaseInsert> & Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
