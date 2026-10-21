"use client";

import { useEffect } from "react";
import type { BusinessProfile } from "@/types";

function hasRunToday(dateValue: string | undefined) {
  if (!dateValue) return false;
  return dateValue.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

async function runAutomaticBackupIfDue(settings: Partial<BusinessProfile>) {
  if (
    !settings.autoBackupEnabled ||
    !settings.autoBackupFolderPath ||
    hasRunToday(settings.autoBackupLastRunAt)
  ) {
    return settings;
  }

  const response = await fetch("/api/backup/auto", {
    method: "POST",
    cache: "no-store",
  });
  const result = await response.json().catch(() => null);

  if (result?.settings) {
    localStorage.setItem("posSettings", JSON.stringify(result.settings));
    return result.settings as Partial<BusinessProfile>;
  }

  if (!response.ok) {
    throw new Error(result?.message || "Automatic backup failed");
  }

  return settings;
}

export function SettingsBootstrap() {
  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        const result = await response.json();
        if (!active || !result.settings) return;
        localStorage.setItem("posSettings", JSON.stringify(result.settings));
        await runAutomaticBackupIfDue(result.settings);
      } catch {
        // Settings are optional during first launch.
      }
    };

    loadSettings();
    const intervalId = window.setInterval(loadSettings, 60 * 60 * 1000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
}
