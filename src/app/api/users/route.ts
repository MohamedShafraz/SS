import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { insertRows, readDb, updateRows } from "@/lib/local-store";
import type { AuthRole } from "@/types";
import { authErrorResponse, requireSameOrigin, requireSession } from "@/lib/server-auth";
const VALID_ROLES = new Set<AuthRole>(["admin", "manager", "cashier"]);

async function parseJsonBody(request: NextRequest) {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getAdminUser(request: NextRequest) {
  return requireSession(request, ["admin"]);
}

export async function GET(request: NextRequest) {
  try {
    getAdminUser(request);
    const users = readDb().users.map(({ password_hash, ...user }) => user);
    return NextResponse.json({ users });
  } catch (error: any) {
    if (["Unauthorized", "Forbidden", "Invalid request origin"].includes(error?.message)) return authErrorResponse(error);
    return NextResponse.json({ message: "Failed to load users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    getAdminUser(request);
    const body = await parseJsonBody(request);

    if (!body) {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const email = isNonEmptyString(body.email) ? body.email.trim().toLowerCase() : "";
    const name = isNonEmptyString(body.name) ? body.name.trim() : null;
    const password = isNonEmptyString(body.password) ? body.password : "";
    const role = isNonEmptyString(body.role) ? (body.role.trim() as AuthRole) : "cashier";

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
    }
    if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      return NextResponse.json({ message: "Password must be at least 10 characters with upper-case, lower-case, and a number" }, { status: 400 });
    }

    if (!VALID_ROLES.has(role)) {
      return NextResponse.json({ message: "Invalid role" }, { status: 400 });
    }

    if (readDb().users.some((user) => user.email === email)) {
      return NextResponse.json({ message: "Email already exists" }, { status: 409 });
    }

    const { data } = insertRows("users", [
      {
        email,
        name,
        password_hash: await bcrypt.hash(password, 12),
        role,
        active: true,
        last_login: null,
      },
    ]);

    const { password_hash, ...user } = data[0];
    return NextResponse.json({ user }, { status: 201 });
  } catch (error: any) {
    if (["Unauthorized", "Forbidden", "Invalid request origin"].includes(error?.message)) return authErrorResponse(error);
    return NextResponse.json({ message: "Failed to create user" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    requireSameOrigin(request);
    getAdminUser(request);
    const body = await parseJsonBody(request);
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ message: "User id is required" }, { status: 400 });
    const current = readDb().users.find((user) => user.id === id);
    if (!current) return NextResponse.json({ message: "User not found" }, { status: 404 });
    if (body?.role !== undefined && (!isNonEmptyString(body.role) || !VALID_ROLES.has(body.role as AuthRole))) {
      return NextResponse.json({ message: "Invalid role" }, { status: 400 });
    }
    const adminCount = readDb().users.filter((user) => user.role === "admin" && user.active).length;
    const removesLastAdmin = current.role === "admin" && adminCount <= 1 &&
      (body?.role !== undefined && body.role !== "admin" || body?.active === false);
    if (removesLastAdmin) {
      return NextResponse.json({ message: "At least one active admin is required" }, { status: 400 });
    }
    const values: Record<string, unknown> = {};
    if (isNonEmptyString(body?.name)) values.name = body.name.trim();
    if (isNonEmptyString(body?.role) && VALID_ROLES.has(body.role as AuthRole)) values.role = body.role;
    if (typeof body?.active === "boolean") values.active = body.active;
    const { data } = updateRows("users", values, [{ column: "id", op: "eq", value: id }]);
    const { password_hash, ...user } = data[0];
    return NextResponse.json({ user });
  } catch (error: any) {
    if (["Unauthorized", "Forbidden", "Invalid request origin"].includes(error?.message)) return authErrorResponse(error);
    return NextResponse.json({ message: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const actor = getAdminUser(request);
    const body = await parseJsonBody(request);
    const id = typeof body?.id === "string" ? body.id : "";
    const current = readDb().users.find((user) => user.id === id);
    if (!current) return NextResponse.json({ message: "User not found" }, { status: 404 });
    if (id === actor.id) return NextResponse.json({ message: "You cannot delete your own account" }, { status: 400 });
    const adminCount = readDb().users.filter((user) => user.role === "admin" && user.active).length;
    if (current.role === "admin" && adminCount <= 1) return NextResponse.json({ message: "At least one active admin is required" }, { status: 400 });
    const { deleteRows } = await import("@/lib/local-store");
    deleteRows("users", [{ column: "id", op: "eq", value: id }]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (["Unauthorized", "Forbidden", "Invalid request origin"].includes(error?.message)) return authErrorResponse(error);
    return NextResponse.json({ message: "Failed to delete user" }, { status: 500 });
  }
}
