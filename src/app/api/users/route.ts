import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

const supabase = createClient(
  process.env.NEXT_PUBLIC_POS_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_POS_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

const VALID_ROLES = new Set(["admin", "cashier"]);

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

function getAdminUser(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;

  if (!token) {
    throw new Error("Unauthorized");
  }

  const payload = jwt.verify(token, JWT_SECRET) as { role?: string };
  if (payload.role !== "admin") {
    throw new Error("Forbidden");
  }

  return payload;
}

export async function GET(request: NextRequest) {
  try {
    getAdminUser(request);

    const { data, error } = await supabase.rpc("admin_list_users");

    if (error) {
      console.error("Failed to list users:", error);
      return NextResponse.json({ message: "Failed to list users" }, { status: 500 });
    }

    return NextResponse.json({ users: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message === "Forbidden" ? "Forbidden" : "Unauthorized" },
      { status: error?.message === "Forbidden" ? 403 : 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    getAdminUser(request);

    const body = await parseJsonBody(request);

    if (!body) {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const email = isNonEmptyString(body.email) ? body.email.trim() : "";
    const name = isNonEmptyString(body.name) ? body.name.trim() : null;
    const password = isNonEmptyString(body.password) ? body.password : "";
    const role = isNonEmptyString(body.role) ? body.role.trim() : "cashier";

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required" },
        { status: 400 }
      );
    }

    if (!VALID_ROLES.has(role)) {
      return NextResponse.json({ message: "Invalid role" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("admin_create_user", {
      p_email: email,
      p_name: name,
      p_password: password,
      p_role: role,
    });

    if (error) {
      console.error("Failed to create user:", error);
      return NextResponse.json({ message: "Failed to create user" }, { status: 500 });
    }

    return NextResponse.json({ user: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message === "Forbidden" ? "Forbidden" : "Unauthorized" },
      { status: error?.message === "Forbidden" ? 403 : 401 }
    );
  }
}
