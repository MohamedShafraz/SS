"use client";

import { useEffect } from "react";

export function SettingsBootstrap() {
  useEffect(() => {
    let active = true;

    fetch("/api/settings")
      .then((response) => response.json())
      .then((result) => {
        if (!active || !result.settings) return;
        localStorage.setItem("posSettings", JSON.stringify(result.settings));
      })
      .catch(() => {
        // Settings are optional during first launch.
      });

    return () => {
      active = false;
    };
  }, []);

  return null;
}
