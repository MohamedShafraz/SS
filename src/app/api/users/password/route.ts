import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { readDb, updateRows } from "@/lib/local-store";
import { authErrorResponse, requireSameOrigin, requireSession } from "@/lib/server-auth";

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

function requireAdmin(request: NextRequest) {
  requireSession(request, ["admin"]);
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    requireAdmin(request);
    const body = await parseJsonBody(request);

    if (!body) {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const email = isNonEmptyString(body.email) ? body.email.trim().toLowerCase() : "";
    const password = isNonEmptyString(body.password) ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ message: "Email and new password are required" }, { status: 400 });
    }
    if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      return NextResponse.json({ message: "Password must be at least 10 characters with upper-case, lower-case, and a number" }, { status: 400 });
    }

    const user = readDb().users.find((candidate) => candidate.email === email);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const { data } = updateRows("users", { password_hash: await bcrypt.hash(password, 12) }, [
      { column: "id", op: "eq", value: user.id },
    ]);
    const { password_hash, ...updatedUser } = data[0];

    return NextResponse.json({ user: updatedUser });
  } catch (error: any) {
    if (["Unauthorized", "Forbidden", "Invalid request origin"].includes(error?.message)) return authErrorResponse(error);
    return NextResponse.json({ message: "Failed to update password" }, { status: 500 });
  }
}
