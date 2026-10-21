import { NextResponse } from "next/server";
import {
  accessSync,
  constants,
  existsSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import { backupDb, insertRows, readDb, updateRows } from "@/lib/local-store";

export const dynamic = "force-dynamic";

const SETTINGS_KEY = "posSettings";
const AUTO_BACKUP_PREFIX = "pos-auto-backup-";
const AUTO_BACKUP_RETENTION = 14;

type SettingsRecord = Record<string, unknown>;

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function isSettingsRecord(value: unknown): value is SettingsRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readSettingsRow() {
  return readDb().settings.find((setting) => setting.key === SETTINGS_KEY) || null;
}

function saveSettings(settings: SettingsRecord) {
  const existing = readSettingsRow();
  if (existing) {
    updateRows("settings", { value: settings }, [
      { column: "id", op: "eq", value: existing.id },
    ]);
    return;
  }

  insertRows("settings", [{ key: SETTINGS_KEY, value: settings }]);
}

function updateBackupStatus(
  settings: SettingsRecord,
  status: "success" | "skipped" | "error",
  message: string,
  backupPath = ""
) {
  const nextSettings = {
    ...settings,
    autoBackupLastRunAt: new Date().toISOString(),
    autoBackupLastStatus: status,
    autoBackupLastMessage: message,
    autoBackupLastPath: backupPath,
  };
  saveSettings(nextSettings);
  return nextSettings;
}

function validateBackupFolder(folderPath: string) {
  if (!folderPath) {
    throw new Error("Choose a backup folder before enabling automatic backup");
  }

  if (!existsSync(folderPath) || !statSync(folderPath).isDirectory()) {
    throw new Error("Backup folder was not found. Choose a folder on an available drive.");
  }

  accessSync(folderPath, constants.W_OK);
}

function pruneOldBackups(folderPath: string) {
  const backups = readdirSync(folderPath)
    .filter((file) => /^pos-auto-backup-\d{4}-\d{2}-\d{2}\.sqlite$/i.test(file))
    .sort()
    .reverse();

  for (const file of backups.slice(AUTO_BACKUP_RETENTION)) {
    try {
      unlinkSync(join(folderPath, file));
    } catch {
      // Retention cleanup is best-effort; the backup itself already succeeded.
    }
  }
}

export async function POST() {
  const settingsRow = readSettingsRow();
  const settings = isSettingsRecord(settingsRow?.value) ? settingsRow.value : null;

  if (!settings?.autoBackupEnabled) {
    return NextResponse.json({
      status: "skipped",
      message: "Automatic backup is off",
      settings,
    });
  }

  const folderPath = String(settings.autoBackupFolderPath || "").trim();

  try {
    validateBackupFolder(folderPath);

    const filename = `${AUTO_BACKUP_PREFIX}${todayStamp()}.sqlite`;
    const backupPath = join(folderPath, filename);

    if (existsSync(backupPath)) {
      const nextSettings = updateBackupStatus(
        settings,
        "skipped",
        "Automatic backup already exists for today",
        backupPath
      );

      return NextResponse.json({
        status: "skipped",
        message: "Automatic backup already exists for today",
        path: backupPath,
        settings: nextSettings,
      });
    }

    await backupDb(backupPath);
    pruneOldBackups(folderPath);

    const nextSettings = updateBackupStatus(
      settings,
      "success",
      "Automatic backup completed",
      backupPath
    );

    return NextResponse.json({
      status: "success",
      message: "Automatic backup completed",
      path: backupPath,
      settings: nextSettings,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Automatic backup failed. Check the selected folder.";
    const nextSettings = updateBackupStatus(settings, "error", message);

    return NextResponse.json(
      {
        status: "error",
        message,
        settings: nextSettings,
      },
      { status: 400 }
    );
  }
}
