import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Routes that require authentication
const protectedRoutes = ["/dashboard", "/pos", "/products", "/transactions", "/settings"];

export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  const pathname = request.nextUrl.pathname;

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
      const decoded = jwt.verify(token, JWT_SECRET) as { role?: string };

      // Cashier can only access dashboard and POS routes
      if (decoded?.role === "cashier") {
        const cashierAllowed = ["/pos"];
        const isCashierAllowed = cashierAllowed.some((route) =>
          pathname.startsWith(route)
        );

        if (!isCashierAllowed) {
          return NextResponse.redirect(new URL("/pos", request.url));
        }
      }

      // Token is valid, allow access
      return NextResponse.next();
    } catch (error) {
      // Token is invalid or expired
      console.log(`[Middleware] Invalid/expired token for ${pathname}, redirecting to login`);
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("auth_token");
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
  ],
};
