import { NextRequest, NextResponse } from "next/server";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { getLocalDbPath, readDb, replaceSqliteDbFromBackup, writeDb } from "@/lib/local-store";

export async function GET() {
  readDb();
  const body = readFileSync(getLocalDbPath());
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/vnd.sqlite3",
      "Content-Disposition": `attachment; filename="pos-backup-${new Date().toISOString().slice(0, 10)}.sqlite"`,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      writeDb(await request.json());
      return NextResponse.json({ message: "JSON backup restored into SQLite" });
    }

    const bytes = Buffer.from(await request.arrayBuffer());
    const restorePath = join(tmpdir(), `pos-restore-${Date.now()}.sqlite`);
    mkdirSync(tmpdir(), { recursive: true });
    writeFileSync(restorePath, bytes);
    replaceSqliteDbFromBackup(restorePath);

    return NextResponse.json({ message: "Backup restored" });
  } catch {
    return NextResponse.json({ message: "Backup file must be a valid SQLite or JSON backup" }, { status: 400 });
  }
}
