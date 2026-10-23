import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createFirstAdminAndSettings } from "@/lib/local-store";
import { requireSameOrigin } from "@/lib/server-auth";

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
  try {
    requireSameOrigin(request);
    const body = await parseJsonBody(request);
    const admin = body?.admin && typeof body.admin === "object" ? body.admin as Record<string, unknown> : null;
    const business = body?.business && typeof body.business === "object" ? body.business as Record<string, unknown> : null;
    const email = typeof admin?.email === "string" ? admin.email.trim().toLowerCase() : "";
    const name = typeof admin?.name === "string" ? admin.name.trim() : "";
    const password = typeof admin?.password === "string" ? admin.password : "";
    const businessName = typeof business?.name === "string" ? business.name.trim() : "";
    const currency = typeof business?.currency === "string" ? business.currency.trim().toUpperCase() : "LKR";

    if (!name || !email || !businessName) {
      return NextResponse.json({ message: "Business name, admin name, and email are required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ message: "Enter a valid admin email" }, { status: 400 });
    }
    if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      return NextResponse.json({ message: "Password must be at least 10 characters with upper-case, lower-case, and a number" }, { status: 400 });
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json({ message: "Currency must use a three-letter code" }, { status: 400 });
    }

    const user = createFirstAdminAndSettings(
      { name, email, passwordHash: await bcrypt.hash(password, 12) },
      {
        businessName,
        address: typeof business?.address === "string" ? business.address.trim() : "",
        phone: typeof business?.phone === "string" ? business.phone.trim() : "",
        email: typeof business?.email === "string" ? business.email.trim() : "",
        currency,
      }
    );
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the first admin";
    const status = message === "First admin already exists" ? 409 : message === "Invalid request origin" ? 403 : 500;
    return NextResponse.json({ message }, { status });
  }
}
