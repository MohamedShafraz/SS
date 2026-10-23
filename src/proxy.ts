import { NextRequest, NextResponse } from "next/server";

function nonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function proxy(request: NextRequest) {
  const value = nonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", value);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const production = process.env.NODE_ENV === "production";
  const connect = production
    ? "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com"
    : "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com ws: wss:";
  const evaluation = production ? "" : " 'unsafe-eval'";
  const upgrade = production ? " upgrade-insecure-requests;" : "";
  response.headers.set("Content-Security-Policy", `default-src 'self'; script-src 'self' 'nonce-${value}' https://www.googletagmanager.com${evaluation}; style-src 'self'; img-src 'self' data: blob: https://www.google-analytics.com; font-src 'self'; ${connect}; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'self' mailto:; frame-ancestors 'none';${upgrade}`);
  if (production) response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
