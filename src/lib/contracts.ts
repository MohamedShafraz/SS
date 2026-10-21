import type {
  AuthRole,
  AuthUser,
  LoginResponse,
  Product,
  ProductRow,
  ProductVariant,
  ProductVariantRow,
  Return,
  ReturnRow,
  ReturnStatus,
  Transaction,
  TransactionItemWithProductRow,
  TransactionRow,
  TransactionStatus,
} from "@/types";

const RETURN_STATUSES = new Set<ReturnStatus>(["pending", "completed", "cancelled"]);
const TRANSACTION_STATUSES = new Set<TransactionStatus>(["pending", "completed", "cancelled"]);
const AUTH_ROLES = new Set<AuthRole>(["admin", "manager", "cashier"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nullableText(value: string | null | undefined): string {
  return value ?? "";
}

export function isAuthRole(value: unknown): value is AuthRole {
  return typeof value === "string" && AUTH_ROLES.has(value as AuthRole);
}

export function isAuthUser(value: unknown): value is AuthUser {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.email === "string" &&
    typeof value.name === "string" &&
    isAuthRole(value.role)
  );
}

export function isLoginResponse(value: unknown): value is LoginResponse {
  return isRecord(value) && typeof value.token === "string" && isAuthUser(value.user);
}

export function readMessage(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.message === "string" ? value.message : fallback;
}

export function normalizeProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    cost: row.cost,
    least_price: row.least_price ?? 0,
    least_price_code: nullableText(row.least_price_code),
    quantity: row.quantity ?? 0,
    image_url: nullableText(row.image_url),
    barcode: nullableText(row.barcode),
    sku: nullableText(row.sku),
    created_at: nullableText(row.created_at),
    updated_at: nullableText(row.updated_at),
  };
}

export function normalizeProductVariant(row: ProductVariantRow): ProductVariant {
  return {
    id: row.id,
    product_id: row.product_id,
    variant_type: row.variant_type,
    variant_value: row.variant_value,
    variant_type_2: row.variant_type_2,
    variant_value_2: row.variant_value_2,
    sku: nullableText(row.sku),
    barcode: nullableText(row.barcode),
    quantity: row.quantity ?? 0,
    price_adjustment: row.price_adjustment ?? 0,
    least_price: row.least_price ?? 0,
    least_price_code: row.least_price_code ?? "",
    image_url: row.image_url,
    created_at: nullableText(row.created_at),
    updated_at: nullableText(row.updated_at),
  };
}

function normalizeTransactionStatus(status: TransactionStatus | null): TransactionStatus | undefined {
  return status && TRANSACTION_STATUSES.has(status) ? status : undefined;
}

function normalizeReturnStatus(status: ReturnStatus | null): ReturnStatus {
  return status && RETURN_STATUSES.has(status) ? status : "pending";
}

export function normalizeTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    transaction_date: row.transaction_date,
    items: [],
    total_amount: row.total_amount,
    discount_amount: row.discount_amount ?? 0,
    tax_amount: row.tax_amount ?? 0,
    amount_paid: row.amount_paid ?? 0,
    balance_amount: row.balance_amount ?? 0,
    payment_method: row.payment_method,
    status: normalizeTransactionStatus(row.status),
    stripe_session_id: row.stripe_session_id,
    user_id: row.user_id,
    created_at: nullableText(row.created_at),
    is_replacement_transaction: row.is_replacement_transaction ?? false,
    original_return_id: row.original_return_id,
    shop_id: row.shop_id,
    customer_name: row.customer_name,
    sale_type: row.sale_type,
    payment_status: row.payment_status,
    due_amount: row.due_amount ?? 0,
  };
}

export function normalizeReturn(row: ReturnRow): Return {
  return {
    id: row.id,
    original_transaction_id: row.original_transaction_id,
    return_date: row.return_date,
    reason: row.reason,
    notes: row.notes,
    status: normalizeReturnStatus(row.status),
    created_at: nullableText(row.created_at),
    updated_at: row.updated_at,
  };
}

export function normalizeTransactionItemWithProduct(row: TransactionItemWithProductRow) {
  return {
    id: row.id,
    transaction_id: row.transaction_id,
    product_id: row.product_id,
    variant_id: row.variant_id,
    quantity: row.quantity,
    unit_price: row.unit_price,
    discount: row.discount ?? 0,
    subtotal: row.subtotal,
    products: row.products
      ? {
          name: row.products.name,
          image_url: nullableText(row.products.image_url),
        }
      : null,
  };
}
