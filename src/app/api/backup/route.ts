import { NextRequest, NextResponse } from "next/server";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import jwt from "jsonwebtoken";
import { backupDb, readDb, replaceSqliteDbFromBackup, writeDb } from "@/lib/local-store";

const INVALID_BACKUP_MESSAGE = "Backup file must be a valid SQLite or JSON backup";
const AUTH_COOKIE_NAME = "auth_token";
const LOCAL_JWT_FALLBACK = "offline-pos-local-session-secret-change-before-client-build";

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

function backupRestoreAdminOnlyEnabled() {
  const settings = readDb().settings.find((setting) => setting.key === "posSettings")?.value;
  if (!settings || typeof settings !== "object") return true;
  return (settings as { backupRestoreAdminOnlyEnabled?: boolean }).backupRestoreAdminOnlyEnabled !== false;
}

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

export async function GET() {
  const backupPath = join(tmpdir(), `pos-backup-${Date.now()}.sqlite`);
  await backupDb(backupPath);
  const body = readFileSync(backupPath);
  try {
    unlinkSync(backupPath);
  } catch {
    // Temporary backup cleanup is best-effort.
  }

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/vnd.sqlite3",
      "Content-Disposition": `attachment; filename="${backupFilename()}"`,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    if (backupRestoreAdminOnlyEnabled() && getSessionRole(request) !== "admin") {
      return NextResponse.json({ message: "Only admins can restore backups" }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") || "";
    const bytes = Buffer.from(await request.arrayBuffer());

    if (looksLikeJsonBackup(contentType, bytes)) {
      writeDb(JSON.parse(bytes.toString("utf8")));
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
  } catch {
    return NextResponse.json({ message: INVALID_BACKUP_MESSAGE }, { status: 400 });
  }
}
