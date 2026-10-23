import { NextRequest, NextResponse } from "next/server";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { backupDb, replaceSqliteDbFromBackup, writeDb } from "@/lib/local-store";
import { authErrorResponse, requireSameOrigin, requireSession } from "@/lib/server-auth";

const INVALID_BACKUP_MESSAGE = "Backup file must be a valid SQLite or JSON backup";
const MAX_BACKUP_BYTES = 250 * 1024 * 1024;
function backupFilename() {
  return `pos-backup-${new Date().toISOString().slice(0, 10)}.sqlite`;
}

function looksLikeJsonBackup(contentType: string, bytes: Buffer) {
  if (contentType.includes("application/json")) return true;
  const firstNonWhitespace = bytes.toString("utf8", 0, Math.min(bytes.length, 64)).trimStart()[0];
  return firstNonWhitespace === "{";
}

function looksLikeSqliteBackup(bytes: Buffer) {
  return bytes.length > 16 && bytes.subarray(0, 16).toString("utf8") === "SQLite format 3\0";
}

export async function GET(request: NextRequest) {
  try {
    requireSession(request, ["admin"]);
    const backupPath = join(tmpdir(), `pos-backup-${Date.now()}.sqlite`);
    await backupDb(backupPath);
    const body = readFileSync(backupPath);
    try { unlinkSync(backupPath); } catch { /* best effort */ }
    return new NextResponse(body, { headers: { "Content-Type": "application/vnd.sqlite3", "Content-Disposition": `attachment; filename="${backupFilename()}"` } });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    requireSession(request, ["admin"]);

    const contentType = request.headers.get("content-type") || "";
    const bytes = Buffer.from(await request.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BACKUP_BYTES) {
      return NextResponse.json({ message: "Backup must be between 1 byte and 250 MB" }, { status: 413 });
    }

    if (looksLikeJsonBackup(contentType, bytes)) {
      const parsed = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.users) || !Array.isArray(parsed.products) || !Array.isArray(parsed.settings)) {
        return NextResponse.json({ message: INVALID_BACKUP_MESSAGE }, { status: 400 });
      }
      writeDb(parsed as Parameters<typeof writeDb>[0]);
      return NextResponse.json({ message: "JSON backup restored into SQLite" });
    }

    if (!looksLikeSqliteBackup(bytes)) {
      return NextResponse.json({ message: INVALID_BACKUP_MESSAGE }, { status: 400 });
    }

    const restorePath = join(tmpdir(), `pos-restore-${Date.now()}.sqlite`);
    mkdirSync(tmpdir(), { recursive: true });
    writeFileSync(restorePath, bytes);
    replaceSqliteDbFromBackup(restorePath);
    try {
      unlinkSync(restorePath);
    } catch {
      // Temporary restore cleanup is best-effort.
    }

    return NextResponse.json({ message: "Backup restored" });
  } catch (error) {
    if (error instanceof Error && ["Unauthorized", "Forbidden", "Invalid request origin"].includes(error.message)) return authErrorResponse(error);
    return NextResponse.json({ message: INVALID_BACKUP_MESSAGE }, { status: 400 });
  }
}
