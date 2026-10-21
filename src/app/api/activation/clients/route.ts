import { NextRequest, NextResponse } from "next/server";
import { listActivationRecords, publicRecord, type ActivationRecord } from "@/lib/activation-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const token = process.env.ACTIVATION_ADMIN_TOKEN;
  if (!token) return false;

  return request.headers.get("authorization") === `Bearer ${token}`;
}

function parseStatus(value: string | null): ActivationRecord["status"] | "all" {
  if (value === "issued" || value === "active" || value === "disabled") return value;

  return "all";
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const status = parseStatus(searchParams.get("status"));
  const limit = Number(searchParams.get("limit") || 100);

  try {
    const records = await listActivationRecords({ query, status, limit });

    return NextResponse.json({ clients: records.map(publicRecord) });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not list clients" },
      { status: 500 }
    );
  }
}
