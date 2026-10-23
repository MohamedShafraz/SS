import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, requireSameOrigin } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const response = NextResponse.json({ success: true });
    response.cookies.set(AUTH_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      expires: new Date(0),
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ message: "Invalid request origin" }, { status: 403 });
  }
}
