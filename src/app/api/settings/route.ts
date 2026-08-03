import { NextRequest, NextResponse } from "next/server";
import { insertRows, readDb, updateRows } from "@/lib/local-store";

export const dynamic = "force-dynamic";

const SETTINGS_KEY = "posSettings";

export async function GET() {
  const row = readDb().settings.find((setting) => setting.key === SETTINGS_KEY);
  return NextResponse.json({ settings: row?.value || null });
}

export async function POST(request: NextRequest) {
  try {
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
  } catch {
    return NextResponse.json({ message: "Settings must be valid JSON" }, { status: 400 });
  }
}
