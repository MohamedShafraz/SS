import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import type { AuthRole } from "@/types";
import { getSessionIdentity } from "@/lib/local-store";

export const AUTH_COOKIE_NAME = "auth_token";
export const SESSION_TTL_SECONDS = 60 * 60 * 24;

export type SessionUser = {
  id: string;
  email: string;
  role: AuthRole;
};

export class AuthError extends Error {
  constructor(message: "Unauthorized" | "Forbidden" | "Invalid request origin") {
    super(message);
  }
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET is not configured securely");
  }
  return secret;
}

export function readSession(request: NextRequest): SessionUser | null {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as {
      id?: unknown;
      sub?: unknown;
      email?: unknown;
      role?: unknown;
    };
    const id = typeof payload.id === "string" ? payload.id : typeof payload.sub === "string" ? payload.sub : "";
    if (
      !id ||
      typeof payload.email !== "string" ||
      (payload.role !== "admin" && payload.role !== "manager" && payload.role !== "cashier")
    ) {
      return null;
    }
    const current = getSessionIdentity(id);
    if (!current || current.email !== payload.email || current.role !== payload.role) return null;
    return { id, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

export function requireSession(request: NextRequest, roles?: readonly AuthRole[]) {
  const session = readSession(request);
  if (!session) throw new AuthError("Unauthorized");
  if (roles && !roles.includes(session.role)) throw new AuthError("Forbidden");
  return session;
}

export function requireSameOrigin(request: NextRequest) {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return;

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const fetchSite = request.headers.get("sec-fetch-site");
  const hostname = host?.split(":")[0]?.toLowerCase();
  if (!host || (hostname !== "127.0.0.1" && hostname !== "localhost")) {
    throw new AuthError("Invalid request origin");
  }
  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.protocol !== "http:" || parsedOrigin.host !== host) {
        throw new AuthError("Invalid request origin");
      }
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError("Invalid request origin");
    }
    return;
  }
  if (fetchSite !== "same-origin") {
    throw new AuthError("Invalid request origin");
  }
}

export function authErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unauthorized";
  const status = message === "Forbidden" ? 403 : message === "Invalid request origin" ? 403 : 401;
  return NextResponse.json({ message }, { status });
}
