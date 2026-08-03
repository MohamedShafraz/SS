import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { readDb, updateRows } from "@/lib/local-store";

const JWT_SECRET =
  process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32
    ? process.env.JWT_SECRET
    : "offline-pos-local-session-secret-change-before-client-build";

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
  const token = request.cookies.get("auth_token")?.value;
  if (!token) throw new Error("Unauthorized");

  const payload = jwt.verify(token, JWT_SECRET) as { role?: string };
  if (payload.role !== "admin") throw new Error("Forbidden");
}

export async function POST(request: NextRequest) {
  try {
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

    const user = readDb().users.find((candidate) => candidate.email === email);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const { data } = updateRows("users", { password_hash: await bcrypt.hash(password, 10) }, [
      { column: "id", op: "eq", value: user.id },
    ]);
    const { password_hash, ...updatedUser } = data[0];

    return NextResponse.json({ user: updatedUser });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message === "Forbidden" ? "Forbidden" : "Unauthorized" },
      { status: error?.message === "Forbidden" ? 403 : 401 }
    );
  }
}
