import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { readDb, updateRows } from "@/lib/local-store";
import type { AuthRole, UserRow } from "@/types";
import {
  AUTH_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  getJwtSecret,
  requireSameOrigin,
} from "@/lib/server-auth";

const AUTH_ERROR_MESSAGE = "Invalid email or password";

type LoginRequestBody = {
  email?: unknown;
  password?: unknown;
};
type ParsedLoginRequest =
  | { email: string; password: string }
  | { error: string };

function json(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function normalizeRole(role: UserRow["role"]): AuthRole | null {
  return role === "admin" || role === "manager" || role === "cashier"
    ? role
    : null;
}

function normalizeName(name: UserRow["name"], email: string) {
  const trimmedName = name?.trim();
  return trimmedName || email.split("@")[0] || "User";
}

async function parseLoginRequest(request: NextRequest): Promise<ParsedLoginRequest> {
  let body: LoginRequestBody;

  try {
    body = await request.json();
  } catch {
    return { error: "Request body must be valid JSON" };
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  return { email, password };
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const parsed = await parseLoginRequest(request);
    if ("error" in parsed) return json(parsed.error, 400);

    const user = readDb().users.find(
      (candidate) => candidate.email === parsed.email && candidate.active !== false
    ) as UserRow | undefined;

    if (!user) return json(AUTH_ERROR_MESSAGE, 401);

    const passwordMatch = Boolean(
      user.password_hash && (await bcrypt.compare(parsed.password, user.password_hash))
    );

    if (!passwordMatch) return json(AUTH_ERROR_MESSAGE, 401);

    const role = normalizeRole(user.role);
    if (!role) return json(AUTH_ERROR_MESSAGE, 401);

    updateRows("users", { last_login: new Date().toISOString() }, [
      { column: "id", op: "eq", value: user.id },
    ]);

    const token = jwt.sign({ id: user.id, sub: user.id, email: user.email, role }, getJwtSecret(), {
      algorithm: "HS256",
      expiresIn: SESSION_TTL_SECONDS,
    });

    const response = NextResponse.json(
      {
        message: "Login successful",
        token: "authenticated",
        user: {
          id: user.id,
          email: user.email,
          name: normalizeName(user.name, user.email),
          role,
        },
      },
      { status: 200 }
    );

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Unexpected login error", error);
    return json(error instanceof Error && error.message === "Invalid request origin" ? error.message : "Internal server error", error instanceof Error && error.message === "Invalid request origin" ? 403 : 500);
  }
}
