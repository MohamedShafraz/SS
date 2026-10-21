import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import {
  maintenanceDelete,
  maintenanceUpdate,
  readDb,
} from "@/lib/local-store";

const JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32
  ? process.env.JWT_SECRET
  : "offline-pos-local-session-secret-change-before-client-build";

const TABLES = new Set([
  "suppliers",
  "supplier_payments",
  "expenses",
  "companies",
  "shop_accounts",
  "shop_payments",
  "returns",
  "return_items",
  "replacement_items",
  "users",
]);

function requireMaintenanceRole(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) throw new Error("Unauthorized");
  const payload = jwt.verify(token, JWT_SECRET) as { role?: string; sub?: string };
  if (payload.role !== "admin" && payload.role !== "manager") throw new Error("Forbidden");
  return payload;
}

function tableName(value: unknown) {
  if (typeof value !== "string" || !TABLES.has(value)) throw new Error("Unsupported maintenance table");
  return value as Parameters<typeof maintenanceDelete>[0];
}

function responseError(error: unknown) {
  const message = error instanceof Error ? error.message : "Maintenance request failed";
  const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
  return NextResponse.json({ data: null, error: { message } }, { status });
}

export async function GET(request: NextRequest) {
  try {
    requireMaintenanceRole(request);
    const db = readDb();
    return NextResponse.json({
      suppliers: db.suppliers,
      supplier_payments: db.supplier_payments,
      expenses: db.expenses,
      companies: db.companies,
      shop_accounts: db.shop_accounts,
      shop_payments: db.shop_payments,
      returns: db.returns,
      return_items: db.return_items,
      replacement_items: db.replacement_items,
      users: db.users.map(({ password_hash, ...user }) => user),
    });
  } catch (error) {
    return responseError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    requireMaintenanceRole(request);
    const body = await request.json() as { table?: unknown; id?: unknown; values?: Record<string, unknown> };
    const table = tableName(body.table);
    if (typeof body.id !== "string" || !body.id) throw new Error("Record id is required");
    const values = { ...(body.values || {}) };
    delete values.id;
    delete values.password_hash;
    const result = maintenanceUpdate(table, body.id, values);
    return NextResponse.json(result);
  } catch (error) {
    return responseError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = requireMaintenanceRole(request);
    const body = await request.json() as { table?: unknown; id?: unknown };
    const table = tableName(body.table);
    if (typeof body.id !== "string" || !body.id) throw new Error("Record id is required");
    if (table === "users" && body.id === actor.sub) throw new Error("You cannot delete your own account");
    return NextResponse.json(maintenanceDelete(table, body.id));
  } catch (error) {
    return responseError(error);
  }
}
