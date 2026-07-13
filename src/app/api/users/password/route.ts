import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

const supabase = createClient(
  process.env.NEXT_PUBLIC_POS_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_POS_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

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

  if (!token) {
    throw new Error("Unauthorized");
  }

  const payload = jwt.verify(token, JWT_SECRET) as { role?: string };
  if (payload.role !== "admin") {
    throw new Error("Forbidden");
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);

    const body = await parseJsonBody(request);

    if (!body) {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const email = isNonEmptyString(body.email) ? body.email.trim() : "";
    const password = isNonEmptyString(body.password) ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and new password are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("admin_reset_user_password", {
      p_email: email,
      p_password: password,
    });

    if (error) {
      console.error("Failed to reset user password:", error);
      return NextResponse.json({ message: "Failed to reset user password" }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message === "Forbidden" ? "Forbidden" : "Unauthorized" },
      { status: error?.message === "Forbidden" ? 403 : 401 }
    );
  }
}
