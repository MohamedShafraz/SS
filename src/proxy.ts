import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "auth_token";
const protectedRoutes = [
  "/dashboard",
  "/pos",
  "/products",
  "/transactions",
  "/settings",
  "/accounting",
  "/companies",
  "/suppliers",
  "/shops",
];
const cashierAllowedRoutes = ["/pos"];
const managerAllowedRoutes = [
  "/dashboard",
  "/pos",
  "/products",
  "/transactions",
  "/accounting",
  "/companies",
  "/suppliers",
  "/shops",
];

type SessionPayload = { id?: unknown; email?: unknown; role?: unknown; exp?: unknown };

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

function decode(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function safeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) return false;
  let result = 0;
  for (let index = 0; index < left.byteLength; index += 1) result |= left[index] ^ right[index];
  return result === 0;
}

async function verify(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const [headerPart, payloadPart, signaturePart, extra] = token.split(".");
    if (!headerPart || !payloadPart || !signaturePart || extra) return null;
    const header = JSON.parse(new TextDecoder().decode(decode(headerPart))) as { alg?: unknown };
    if (header.alg !== "HS256") return null;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const expected = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${headerPart}.${payloadPart}`))
    );
    if (!safeEqual(expected, decode(signaturePart))) return null;
    const payload = JSON.parse(new TextDecoder().decode(decode(payloadPart))) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (payload.role !== "admin" && payload.role !== "manager" && payload.role !== "cashier") return null;
    return payload;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!protectedRoutes.some((route) => pathname.startsWith(route))) return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const secret = getJwtSecret();
  const session = token && secret ? await verify(token, secret) : null;
  if (!session) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  const allowed = session.role === "cashier" ? cashierAllowedRoutes : session.role === "manager" ? managerAllowedRoutes : protectedRoutes;
  if (!allowed.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL(session.role === "cashier" ? "/pos" : "/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*", "/pos/:path*", "/products/:path*", "/transactions/:path*",
    "/settings/:path*", "/accounting/:path*", "/companies/:path*", "/suppliers/:path*", "/shops/:path*",
  ],
};
