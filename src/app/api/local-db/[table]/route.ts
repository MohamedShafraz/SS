import { NextRequest, NextResponse } from "next/server";
import {
  deleteRows,
  insertRows,
  selectRows,
  updateRows,
  type LocalFilter,
  type LocalOrder,
} from "@/lib/local-store";
import { authErrorResponse, requireSameOrigin, requireSession } from "@/lib/server-auth";

const TABLES = new Set([
  "products",
  "product_variants",
  "transactions",
  "transaction_items",
  "returns",
  "return_items",
  "replacement_items",
  "suppliers",
  "shop_accounts",
  "shop_payments",
  "supplier_payments",
  "expenses",
  "companies",
]);

type Role = "admin" | "manager" | "cashier";
type GenericTable = Parameters<typeof selectRows>[0];

const READ_ROLES: Record<GenericTable, readonly Role[]> = {
  products: ["admin", "manager", "cashier"],
  product_variants: ["admin", "manager", "cashier"],
  transactions: ["admin", "manager"],
  transaction_items: ["admin", "manager"],
  returns: ["admin", "manager"],
  return_items: ["admin", "manager"],
  replacement_items: ["admin", "manager"],
  suppliers: ["admin", "manager"],
  shop_accounts: ["admin", "manager", "cashier"],
  shop_payments: ["admin", "manager"],
  supplier_payments: ["admin", "manager"],
  expenses: ["admin", "manager"],
  companies: ["admin", "manager"],
  users: [],
  settings: [],
  licenses: [],
};

// Sale, item, return, replacement and shop-payment writes are deliberately absent.
// They must go through their dedicated transactional API instead of this generic facade.
const CREATE_ROLES: Partial<Record<GenericTable, readonly Role[]>> = {
  products: ["admin", "manager"],
  product_variants: ["admin", "manager"],
  suppliers: ["admin", "manager"],
  supplier_payments: ["admin", "manager"],
  shop_accounts: ["admin", "manager", "cashier"],
  expenses: ["admin", "manager"],
  companies: ["admin", "manager"],
};

const UPDATE_ROLES: Partial<Record<GenericTable, readonly Role[]>> = {
  ...CREATE_ROLES,
  shop_accounts: ["admin", "manager"],
};

const DELETE_ROLES: Partial<Record<GenericTable, readonly Role[]>> = {
  ...UPDATE_ROLES,
};

const WRITABLE_COLUMNS: Partial<Record<GenericTable, readonly string[]>> = {
  products: ["name", "category", "price", "cost", "least_price", "least_price_code", "company_id", "quantity", "image_url", "barcode", "sku"],
  product_variants: ["product_id", "variant_type", "variant_value", "variant_type_2", "variant_value_2", "sku", "barcode", "quantity", "price_adjustment", "least_price", "least_price_code", "image_url"],
  suppliers: ["name", "phone", "email", "address", "products", "total_amount", "paid_amount", "due_amount", "payment_status"],
  supplier_payments: ["supplier_id", "payment_date", "amount", "notes"],
  shop_accounts: ["name", "phone", "address", "notes"],
  expenses: ["expense_date", "category", "description", "amount"],
  companies: ["name", "notes"],
};

const CASHIER_SHOP_COLUMNS = new Set(["name", "phone", "address", "notes"]);
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_INSERT_ROWS = 100;

type Params = {
  params: Promise<{
    table: string;
  }>;
};

function tableName(raw: string) {
  if (!TABLES.has(raw)) {
    throw new Error("Unknown local table");
  }
  return raw as Parameters<typeof selectRows>[0];
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function transactionDateKey(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const datePrefix = value.trim().match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (datePrefix) {
    return datePrefix;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : localDateKey(parsed);
}

function isTodayTransaction(row: unknown) {
  if (!row || typeof row !== "object") {
    return false;
  }

  return transactionDateKey((row as { transaction_date?: unknown }).transaction_date) === localDateKey();
}

function todayTransactionIds() {
  const result = selectRows("transactions", {
    filters: [],
    order: null,
    select: "*",
    single: false,
    maybeSingle: false,
  });

  return new Set(
    (Array.isArray(result.data) ? result.data : [])
      .filter(isTodayTransaction)
      .map((row) => (row as { id?: unknown }).id)
      .filter((value): value is string => typeof value === "string")
  );
}

async function readBody(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new Error("Request body is too large");
  }
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function assertRole(roles: readonly Role[] | undefined, role: Role) {
  if (!roles?.includes(role)) throw new Error("Forbidden");
}

function parseFilters(value: unknown): LocalFilter[] {
  if (!Array.isArray(value)) throw new Error("Filters must be an array");
  return value as LocalFilter[];
}

function requireSingleIdFilter(filters: LocalFilter[]) {
  if (
    filters.length !== 1 ||
    filters[0]?.column !== "id" ||
    filters[0]?.op !== "eq" ||
    typeof filters[0]?.value !== "string" ||
    !filters[0].value.trim()
  ) {
    throw new Error("Generic changes require one record id");
  }
}

function sanitizeValues(table: GenericTable, values: unknown, role: Role) {
  if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error("Invalid values");
  const allowed = new Set(WRITABLE_COLUMNS[table] || []);
  if (role === "cashier" && table === "shop_accounts") {
    for (const column of [...allowed]) if (!CASHIER_SHOP_COLUMNS.has(column)) allowed.delete(column);
  }
  // Timestamps are server-owned. Older clients may still send updated_at, so
  // accept-but-ignore it for backward compatibility.
  const serverOwnedColumns = table === "shop_accounts"
    ? new Set(["updated_at", "total_billed", "total_paid", "due_amount", "payment_status"])
    : new Set(["updated_at"]);
  const entries = Object.entries(values as Record<string, unknown>).filter(([column]) => !serverOwnedColumns.has(column));
  if (!entries.length || entries.some(([column]) => !allowed.has(column))) {
    throw new Error("One or more columns cannot be changed through this API");
  }
  return Object.fromEntries(entries);
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = requireSession(request);
    const table = tableName((await params).table);
    assertRole(READ_ROLES[table], session.role);
    const filters = JSON.parse(request.nextUrl.searchParams.get("filters") || "[]") as LocalFilter[];
    const order = JSON.parse(request.nextUrl.searchParams.get("order") || "null") as LocalOrder | null;
    const select = request.nextUrl.searchParams.get("select") || "*";
    const single = request.nextUrl.searchParams.get("single") === "true";
    const maybeSingle = request.nextUrl.searchParams.get("maybeSingle") === "true";

    const result = selectRows(table, { filters, order, select, single, maybeSingle });
    const role = session.role;

    if (role === "manager" && table === "transactions") {
      if (Array.isArray(result.data)) {
        return NextResponse.json({
          ...result,
          data: result.data.filter(isTodayTransaction),
        });
      }

      if (result.data && !isTodayTransaction(result.data)) {
        return NextResponse.json({
          data: null,
          error: { message: "Row not found", code: "PGRST116" },
        });
      }
    }

    if (role === "manager" && table === "transaction_items") {
      const allowedTransactionIds = todayTransactionIds();

      if (Array.isArray(result.data)) {
        return NextResponse.json({
          ...result,
          data: result.data.filter((row) =>
            allowedTransactionIds.has((row as { transaction_id?: unknown }).transaction_id as string)
          ),
        });
      }

      if (
        result.data &&
        !allowedTransactionIds.has((result.data as { transaction_id?: unknown }).transaction_id as string)
      ) {
        return NextResponse.json({
          data: null,
          error: { message: "Row not found", code: "PGRST116" },
        });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Forbidden")) return authErrorResponse(error);
    return NextResponse.json(
      { data: null, error: { message: error instanceof Error ? error.message : "Local query failed" } },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    requireSameOrigin(request);
    const session = requireSession(request);
    const table = tableName((await params).table);
    assertRole(CREATE_ROLES[table], session.role);
    const body = await readBody(request);
    if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > MAX_INSERT_ROWS) {
      throw new Error(`Insert requires between 1 and ${MAX_INSERT_ROWS} rows`);
    }
    const rows = body.rows.map((row: unknown) => sanitizeValues(table, row, session.role));
    return NextResponse.json(insertRows(table, rows));
  } catch (error) {
    if (error instanceof Error && ["Unauthorized", "Forbidden", "Invalid request origin"].includes(error.message)) return authErrorResponse(error);
    return NextResponse.json(
      { data: null, error: { message: error instanceof Error ? error.message : "Local insert failed" } },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    requireSameOrigin(request);
    const session = requireSession(request);
    const table = tableName((await params).table);
    assertRole(UPDATE_ROLES[table], session.role);
    const body = await readBody(request);
    const filters = parseFilters(body.filters);
    requireSingleIdFilter(filters);
    const values = sanitizeValues(table, body.values, session.role);
    return NextResponse.json(updateRows(table, values, filters));
  } catch (error) {
    if (error instanceof Error && ["Unauthorized", "Forbidden", "Invalid request origin"].includes(error.message)) return authErrorResponse(error);
    return NextResponse.json(
      { data: null, error: { message: error instanceof Error ? error.message : "Local update failed" } },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    requireSameOrigin(request);
    const session = requireSession(request);
    const table = tableName((await params).table);
    assertRole(DELETE_ROLES[table], session.role);

    const filters = parseFilters(JSON.parse(request.nextUrl.searchParams.get("filters") || "[]"));
    requireSingleIdFilter(filters);
    return NextResponse.json(deleteRows(table, filters));
  } catch (error) {
    if (error instanceof Error && ["Unauthorized", "Forbidden", "Invalid request origin"].includes(error.message)) return authErrorResponse(error);
    return NextResponse.json(
      { data: null, error: { message: error instanceof Error ? error.message : "Local delete failed" } },
      { status: 400 }
    );
  }
}
