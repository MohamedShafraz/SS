import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { deleteTransactionAndRestoreStock, readDb } from "@/lib/local-store";
import type { BusinessProfile } from "@/types";

export const dynamic = "force-dynamic";

const AUTH_COOKIE_NAME = "auth_token";
const LOCAL_JWT_FALLBACK = "offline-pos-local-session-secret-change-before-client-build";
const SETTINGS_KEY = "posSettings";

type Params = {
  params: {
    id: string;
  };
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();

  return secret && secret.length >= 32 ? secret : LOCAL_JWT_FALLBACK;
}

function getSessionRole(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) return null;

  try {
    const payload = jwt.verify(token, getJwtSecret()) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function transactionDeleteEnabled() {
  const row = readDb().settings.find((setting) => setting.key === SETTINGS_KEY);
  const settings = row?.value as Partial<BusinessProfile> | null | undefined;
  return Boolean(settings?.allowTransactionDelete);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    if (getSessionRole(request) !== "admin") {
      return NextResponse.json({ message: "Only admins can delete transactions" }, { status: 403 });
    }

    if (!transactionDeleteEnabled()) {
      return NextResponse.json({ message: "Transaction deletion is disabled in settings" }, { status: 403 });
    }

    const transactionId = params.id?.trim();
    if (!transactionId) {
      return NextResponse.json({ message: "Transaction id is required" }, { status: 400 });
    }

    const result = deleteTransactionAndRestoreStock(transactionId);
    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: 404 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to delete transaction" },
      { status: 500 }
    );
  }
}
