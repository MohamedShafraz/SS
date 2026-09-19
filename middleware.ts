import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "auth_token";
const LOCAL_JWT_FALLBACK = "offline-pos-local-session-secret-change-before-client-build";

// Routes that require authentication
const protectedRoutes = ["/dashboard", "/pos", "/products", "/transactions", "/settings"];
const cashierAllowedRoutes = ["/pos"];
const managerAllowedRoutes = ["/dashboard", "/pos", "/products", "/transactions"];

type SessionPayload = {
  id?: unknown;
  email?: unknown;
  role?: unknown;
  exp?: unknown;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();

  return secret && secret.length >= 32 ? secret : LOCAL_JWT_FALLBACK;
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function base64UrlToJson(value: string) {
  const bytes = base64UrlToBytes(value);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as unknown;
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) {
    return false;
  }

  let diff = 0;

  for (let i = 0; i < left.byteLength; i += 1) {
    diff |= left[i] ^ right[i];
  }

  return diff === 0;
}

async function verifySessionToken(token: string, secret: string) {
  const parts = token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = base64UrlToJson(encodedHeader);

  if (
    !header ||
    typeof header !== "object" ||
    (header as { alg?: unknown }).alg !== "HS256"
  ) {
    return null;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    )
  );
  const expectedSignature = base64UrlToBytes(encodedSignature);

  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  const payload = base64UrlToJson(encodedPayload) as SessionPayload;
  const expiresAt = typeof payload.exp === "number" ? payload.exp : 0;

  if (expiresAt <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  if (
    payload.role !== "admin" &&
    payload.role !== "manager" &&
    payload.role !== "cashier"
  ) {
    return null;
  }

  return payload;
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api/payments/stripe")) {
    return NextResponse.json(
      { message: "Online Stripe payments are disabled in the offline Windows build" },
      { status: 410 }
    );
  }

  if (pathname.startsWith("/register") || pathname.startsWith("/payment") || pathname === "/activate") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Allow login page without authentication
  if (pathname === "/login" || pathname === "/") {
    return NextResponse.next();
  }

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute) {
    // No token - redirect to login
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Token exists - verify it
    try {
      const jwtSecret = getJwtSecret();
      const decoded = jwtSecret ? await verifySessionToken(token, jwtSecret) : null;

      if (!decoded) {
        throw new Error("Invalid session");
      }

      // Cashier sessions are limited to the POS route.
      if (decoded.role === "cashier") {
        const isCashierAllowed = cashierAllowedRoutes.some((route) =>
          pathname.startsWith(route)
        );

        if (!isCashierAllowed) {
          return NextResponse.redirect(new URL("/pos", request.url));
        }
      }

      if (decoded.role === "manager") {
        const isManagerAllowed = managerAllowedRoutes.some((route) =>
          pathname.startsWith(route)
        );

        if (!isManagerAllowed) {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
      }

      // Token is valid, allow access
      return NextResponse.next();
    } catch {
      // Token is invalid or expired
      console.warn(`[Middleware] Invalid or expired session for ${pathname}`);
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Explicitly protect these routes
    "/dashboard/:path*",
    "/pos/:path*",
    "/products/:path*",
    "/transactions/:path*",
    "/settings/:path*",
    // Also match root and login (so we can allow them)
    "/",
    "/login",
    "/activate",
    "/register/:path*",
    "/payment/:path*",
    "/api/payments/stripe/:path*",
  ],
};
