import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { insertRows, readDb } from "@/lib/local-store";
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

export async function GET(request: NextRequest) {
  try {
    getAdminUser(request);
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
