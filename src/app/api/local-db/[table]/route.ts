import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import {
  deleteRows,
  insertRows,
  selectRows,
  updateRows,
  type LocalFilter,
  type LocalOrder,
} from "@/lib/local-store";

const AUTH_COOKIE_NAME = "auth_token";
const LOCAL_JWT_FALLBACK = "offline-pos-local-session-secret-change-before-client-build";

const TABLES = new Set([
  "products",
  "product_variants",
  "transactions",
  "transaction_items",
  "returns",
  "return_items",
  "replacement_items",
  "suppliers",
  "supplier_payments",
  "expenses",
  "companies",
  "users",
  "settings",
  "licenses",
]);

type Params = {
  params: {
    table: string;
  };
};

function tableName(raw: string) {
  if (!TABLES.has(raw)) {
    throw new Error("Unknown local table");
  }
  return raw as Parameters<typeof selectRows>[0];
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();

  return secret && secret.length >= 32 ? secret : LOCAL_JWT_FALLBACK;
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

function getSessionRole(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

async function readBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const table = tableName(params.table);
    const filters = JSON.parse(request.nextUrl.searchParams.get("filters") || "[]") as LocalFilter[];
    const order = JSON.parse(request.nextUrl.searchParams.get("order") || "null") as LocalOrder | null;
    const select = request.nextUrl.searchParams.get("select") || "*";
    const single = request.nextUrl.searchParams.get("single") === "true";
    const maybeSingle = request.nextUrl.searchParams.get("maybeSingle") === "true";

    const result = selectRows(table, { filters, order, select, single, maybeSingle });
    const role = getSessionRole(request);

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
    return NextResponse.json(
      { data: null, error: { message: error instanceof Error ? error.message : "Local query failed" } },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const table = tableName(params.table);
    const body = await readBody(request);
    return NextResponse.json(insertRows(table, Array.isArray(body.rows) ? body.rows : []));
  } catch (error) {
    return NextResponse.json(
      { data: null, error: { message: error instanceof Error ? error.message : "Local insert failed" } },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const table = tableName(params.table);
    const body = await readBody(request);
    return NextResponse.json(updateRows(table, body.values || {}, body.filters || []));
  } catch (error) {
    return NextResponse.json(
      { data: null, error: { message: error instanceof Error ? error.message : "Local update failed" } },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const table = tableName(params.table);
    const filters = JSON.parse(request.nextUrl.searchParams.get("filters") || "[]") as LocalFilter[];
    return NextResponse.json(deleteRows(table, filters));
  } catch (error) {
    return NextResponse.json(
      { data: null, error: { message: error instanceof Error ? error.message : "Local delete failed" } },
      { status: 400 }
    );
  }
}
