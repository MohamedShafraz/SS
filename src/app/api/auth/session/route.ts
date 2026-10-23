import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/local-store";
import { AUTH_COOKIE_NAME, readSession } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = readSession(request);
  const user = session
    ? readDb().users.find((candidate) => candidate.id === session.id && candidate.active !== false)
    : null;

  if (!session || !user) {
    const response = NextResponse.json({ user: null }, { status: 401 });
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name || user.email.split("@")[0], role: user.role },
  });
}
