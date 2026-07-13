import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const AUTH_COOKIE_NAME = "auth_token";
const SESSION_TTL_SECONDS = 60 * 60 * 24;
const AUTH_ERROR_MESSAGE = "Invalid email or password";

type LoginRequestBody = {
  email?: unknown;
  password?: unknown;
};

type LoginParseResult =
  | { email: string; password: string }
  | { error: string };

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "manager" | "cashier" | null;
  password_hash: string | null;
};

function json(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret || secret.length < 32) {
    return null;
  }

  return secret;
}

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_POS_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_POS_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

function normalizeRole(role: AuthUser["role"]) {
  return role === "admin" || role === "manager" || role === "cashier"
    ? role
    : null;
}

function normalizeName(name: AuthUser["name"], email: string) {
  const trimmedName = name?.trim();

  if (trimmedName) {
    return trimmedName;
  }

  return email.split("@")[0] || "User";
}

async function parseLoginRequest(
  request: NextRequest
): Promise<LoginParseResult> {
  let body: LoginRequestBody;

  try {
    body = await request.json();
  } catch {
    return { error: "Request body must be valid JSON" };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be a JSON object" };
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  if (email.length > 254 || password.length > 1024) {
    return { error: "Email or password is too long" };
  }

  return { email, password };
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseLoginRequest(request);

    if ("error" in parsed) {
      return json(parsed.error, 400);
    }

    const jwtSecret = getJwtSecret();
    const supabase = getSupabaseClient();

    if (!jwtSecret || !supabase) {
      console.error("Authentication is not configured correctly");
      return json("Authentication service is unavailable", 503);
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("id,email,name,role,password_hash")
      .eq("email", parsed.email)
      .eq("active", true)
      .maybeSingle<AuthUser>();

    if (error || !user) {
      if (error) {
        console.error("Login user lookup failed", {
          code: error.code,
          message: error.message,
        });
      }

      return json(AUTH_ERROR_MESSAGE, 401);
    }

    let passwordMatch = false;

    try {
      passwordMatch = Boolean(
        user.password_hash &&
          (await bcrypt.compare(parsed.password, user.password_hash))
      );
    } catch {
      console.error("Password verification failed");
      return json(AUTH_ERROR_MESSAGE, 401);
    }

    if (!passwordMatch) {
      return json(AUTH_ERROR_MESSAGE, 401);
    }

    const role = normalizeRole(user.role);

    if (!role) {
      console.error("Login user has an unsupported role", { userId: user.id });
      return json(AUTH_ERROR_MESSAGE, 401);
    }

    const { error: lastLoginError } = await supabase
      .from("users")
      .update({ last_login: new Date().toISOString() })
      .eq("id", user.id);

    if (lastLoginError) {
      console.error("Last-login update failed", {
        code: lastLoginError.code,
        message: lastLoginError.message,
      });
    }

    let token: string;

    try {
      token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role,
        },
        jwtSecret,
        {
          algorithm: "HS256",
          expiresIn: SESSION_TTL_SECONDS,
        }
      );
    } catch {
      console.error("Session token signing failed");
      return json("Authentication service is unavailable", 503);
    }

    const response = NextResponse.json(
      {
        message: "Login successful",
        token: "authenticated",
        user: {
          id: user.id,
          email: user.email,
          name: normalizeName(user.name, user.email),
          role,
        },
      },
      { status: 200 }
    );

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    });

    return response;
  } catch {
    console.error("Unexpected login error");
    return json("Internal server error", 500);
  }
}
