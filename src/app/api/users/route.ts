import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { insertRows, readDb, updateRows } from "@/lib/local-store";
import type { AuthRole } from "@/types";

const JWT_SECRET =
  process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32
    ? process.env.JWT_SECRET
    : "offline-pos-local-session-secret-change-before-client-build";
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
  const token = request.cookies.get("auth_token")?.value;
  if (!token) throw new Error("Unauthorized");

  const payload = jwt.verify(token, JWT_SECRET) as { role?: string };
  if (payload.role !== "admin") throw new Error("Forbidden");
  return payload;
}

function getManagerUser(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) throw new Error("Unauthorized");
  const payload = jwt.verify(token, JWT_SECRET) as { role?: string; sub?: string };
  if (payload.role !== "admin" && payload.role !== "manager") throw new Error("Forbidden");
  return payload;
}

export async function GET(request: NextRequest) {
  try {
    getManagerUser(request);
    const users = readDb().users.map(({ password_hash, ...user }) => user);
    return NextResponse.json({ users });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message === "Forbidden" ? "Forbidden" : "Unauthorized" },
      { status: error?.message === "Forbidden" ? 403 : 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
        password_hash: await bcrypt.hash(password, 10),
        role,
        active: true,
        last_login: null,
      },
    ]);

    const { password_hash, ...user } = data[0];
    return NextResponse.json({ user }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message === "Forbidden" ? "Forbidden" : "Unauthorized" },
      { status: error?.message === "Forbidden" ? 403 : 401 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = getManagerUser(request);
    const body = await parseJsonBody(request);
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ message: "User id is required" }, { status: 400 });
    const current = readDb().users.find((user) => user.id === id);
    if (!current) return NextResponse.json({ message: "User not found" }, { status: 404 });
    if (actor.role !== "admin" && (body?.role === "admin" || current.role === "admin")) {
      return NextResponse.json({ message: "Only admins can manage admin accounts" }, { status: 403 });
    }
    const values: Record<string, unknown> = {};
    if (isNonEmptyString(body?.name)) values.name = body.name.trim();
    if (isNonEmptyString(body?.role) && VALID_ROLES.has(body.role as AuthRole)) values.role = body.role;
    if (typeof body?.active === "boolean") values.active = body.active;
    const { data } = updateRows("users", values, [{ column: "id", op: "eq", value: id }]);
    const { password_hash, ...user } = data[0];
    return NextResponse.json({ user });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message === "Forbidden" ? "Forbidden" : "Unauthorized" }, { status: error?.message === "Forbidden" ? 403 : 401 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = getManagerUser(request);
    const body = await parseJsonBody(request);
    const id = typeof body?.id === "string" ? body.id : "";
    const current = readDb().users.find((user) => user.id === id);
    if (!current) return NextResponse.json({ message: "User not found" }, { status: 404 });
    if (id === actor.sub) return NextResponse.json({ message: "You cannot delete your own account" }, { status: 400 });
    if (actor.role !== "admin" && current.role === "admin") return NextResponse.json({ message: "Only admins can delete admin accounts" }, { status: 403 });
    const adminCount = readDb().users.filter((user) => user.role === "admin" && user.active).length;
    if (current.role === "admin" && adminCount <= 1) return NextResponse.json({ message: "At least one active admin is required" }, { status: 400 });
    const { deleteRows } = await import("@/lib/local-store");
    deleteRows("users", [{ column: "id", op: "eq", value: id }]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message === "Forbidden" ? "Forbidden" : "Unauthorized" }, { status: error?.message === "Forbidden" ? 403 : 401 });
  }
}
