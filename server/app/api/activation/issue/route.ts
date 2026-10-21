import { NextRequest, NextResponse } from "next/server";
import { issueActivationRecord, publicRecord } from "@/lib/activation-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readBody(request: NextRequest) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isAuthorized(request: NextRequest) {
  const token = process.env.ACTIVATION_ADMIN_TOKEN;
  if (!token) return false;

  return request.headers.get("authorization") === `Bearer ${token}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await readBody(request);
  const licenseKey = typeof body.licenseKey === "string" ? body.licenseKey.trim() : "";
  const clientName = typeof body.clientName === "string" ? body.clientName.trim() : "";
  const expiresAt =
    typeof body.expiresAt === "string" && body.expiresAt.trim() ? body.expiresAt.trim() : null;
  const resetMachine = body.resetMachine === true;

  if (!licenseKey || !clientName) {
    return NextResponse.json(
      { message: "licenseKey and clientName are required" },
      { status: 400 }
    );
  }

  if (!licenseKey.startsWith("OFFLINE-")) {
    return NextResponse.json(
      { message: "License key must start with OFFLINE-" },
      { status: 400 }
    );
  }

  try {
    const record = await issueActivationRecord({
      licenseKey,
      clientName,
      expiresAt,
      resetMachine,
    });

    return NextResponse.json({ license: publicRecord(record) });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not issue license" },
      { status: 500 }
    );
  }
}
