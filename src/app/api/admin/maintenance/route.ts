import { NextRequest, NextResponse } from "next/server";
import {
  maintenanceDelete,
  maintenanceUpdate,
  readDb,
} from "@/lib/local-store";
import { requireSameOrigin, requireSession } from "@/lib/server-auth";

const TABLES = new Set([
  "returns",
]);

function requireMaintenanceRole(request: NextRequest) {
  return requireSession(request, ["admin"]);
}

function tableName(value: unknown) {
  if (typeof value !== "string" || !TABLES.has(value)) throw new Error("Unsupported maintenance table");
  return value as Parameters<typeof maintenanceDelete>[0];
}

function responseError(error: unknown) {
  const message = error instanceof Error ? error.message : "Maintenance request failed";
  const status = message === "Unauthorized" ? 401 : message === "Forbidden" || message === "Invalid request origin" ? 403 : 400;
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
    });
  } catch (error) {
    return responseError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    requireSameOrigin(request);
    requireMaintenanceRole(request);
    const body = await request.json() as { table?: unknown; id?: unknown; values?: Record<string, unknown> };
    const table = tableName(body.table);
    if (typeof body.id !== "string" || !body.id) throw new Error("Record id is required");
    const values = { ...(body.values || {}) };
    delete values.id;
    delete values.password_hash;
    if (table === "returns") {
      const status = values.status;
      if (Object.keys(values).length !== 1 || !["pending", "completed", "cancelled"].includes(String(status))) {
        throw new Error("Only a valid return status can be changed here");
      }
    }
    const result = maintenanceUpdate(table, body.id, values);
    return NextResponse.json(result);
  } catch (error) {
    return responseError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    requireSameOrigin(request);
    requireMaintenanceRole(request);
    const body = await request.json() as { table?: unknown; id?: unknown };
    const table = tableName(body.table);
    if (typeof body.id !== "string" || !body.id) throw new Error("Record id is required");
    return NextResponse.json(maintenanceDelete(table, body.id));
  } catch (error) {
    return responseError(error);
  }
}
