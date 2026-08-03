import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { insertRows, readDb } from "@/lib/local-store";

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

export async function POST(request: NextRequest) {
  const db = readDb();
  const activated = db.licenses.some((license) => license.status === "active");

  if (!activated) {
    return NextResponse.json({ message: "Activate the app before creating the first admin" }, { status: 403 });
  }

  if (db.users.length > 0) {
    return NextResponse.json({ message: "First admin already exists" }, { status: 409 });
  }

  const body = await parseJsonBody(request);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "Local Admin";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
  }

  const { data } = insertRows("users", [
    {
      email,
      name,
      password_hash: await bcrypt.hash(password, 10),
      role: "admin",
      active: true,
      last_login: null,
    },
  ]);

  const { password_hash, ...user } = data[0];
  return NextResponse.json({ user }, { status: 201 });
}
