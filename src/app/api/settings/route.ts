import { NextRequest, NextResponse } from "next/server";
import { insertRows, readDb, updateRows } from "@/lib/local-store";
import { authErrorResponse, requireSameOrigin, requireSession } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const SETTINGS_KEY = "posSettings";

export async function GET(request: NextRequest) {
  try {
    requireSession(request);
    const row = readDb().settings.find((setting) => setting.key === SETTINGS_KEY);
    return NextResponse.json({ settings: row?.value || null });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    requireSession(request, ["admin"]);
    const body = await request.json();
    const settings = body?.settings;

    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return NextResponse.json({ message: "Settings object is required" }, { status: 400 });
    }

    const existing = readDb().settings.find((setting) => setting.key === SETTINGS_KEY);
    if (existing) {
      const { data } = updateRows("settings", { value: settings }, [
        { column: "id", op: "eq", value: existing.id },
      ]);
      return NextResponse.json({ settings: data[0]?.value || settings });
    }

    const { data } = insertRows("settings", [{ key: SETTINGS_KEY, value: settings }]);
    return NextResponse.json({ settings: data[0]?.value || settings }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && ["Unauthorized", "Forbidden", "Invalid request origin"].includes(error.message)) return authErrorResponse(error);
    return NextResponse.json({ message: "Settings must be valid JSON" }, { status: 400 });
  }
}
