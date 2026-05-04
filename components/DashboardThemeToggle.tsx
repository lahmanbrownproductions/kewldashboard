"use client";

import { useCallback, useEffect, useState } from "react";

import { playButtonBeep } from "@/lib/button-beep";
import {
  DASHBOARD_THEME_STORAGE_KEY,
  type DashboardTheme,
  serializeDashboardTheme,
} from "@/lib/dashboard-theme";

function readThemeFromDom(): DashboardTheme {
  if (typeof document === "undefined") {
    return "standard";
  }
  const raw = document.documentElement.dataset.theme;
  return raw === "deep" ? "deep" : "standard";
}

export function DashboardThemeToggle() {
  const [theme, setTheme] = useState<DashboardTheme>("standard");

  useEffect(() => {
    setTheme(readThemeFromDom());
  }, []);

  const cycle = useCallback(() => {
    playButtonBeep();
    const next: DashboardTheme = theme === "standard" ? "deep" : "standard";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, serializeDashboardTheme(next));
    setTheme(next);
  }, [theme]);

  return (
    <button
      type="button"
      className={`dashboard-theme-toggle${theme === "deep" ? " is-deep-active" : ""}`}
      onClick={cycle}
      aria-pressed={theme === "deep"}
      suppressHydrationWarning
      title={theme === "deep" ? "Switch to standard ambient lighting" : "Enable midnight (deeper dark mode)"}
    >
      <span className="dashboard-theme-toggle__label">Midnight</span>
      <span className="dashboard-theme-toggle__state" suppressHydrationWarning>
        {theme === "deep" ? "On" : "Off"}
      </span>
    </button>
  );
}
