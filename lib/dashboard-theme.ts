export const DASHBOARD_THEME_STORAGE_KEY = "kewldashboard.theme.v1";

export type DashboardTheme = "standard" | "deep";

export function parseDashboardTheme(raw: string | null): DashboardTheme | null {
  if (raw === "deep" || raw === "standard") {
    return raw;
  }
  return null;
}

export function serializeDashboardTheme(theme: DashboardTheme): string {
  return theme;
}
