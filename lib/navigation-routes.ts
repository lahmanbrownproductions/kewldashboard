export type NavigationRoute = {
  id: string;
  from: string;
  to: string;
};

export const NAVIGATION_ROUTES_STORAGE_KEY = "kewldashboard.navigationRoutes.v1";

export const MAX_NAVIGATION_ROUTES = 40;
const MAX_FIELD_LEN = 160;

export function sanitizeRouteField(raw: unknown): string {
  if (typeof raw !== "string") {
    return "";
  }
  return raw.trim().slice(0, MAX_FIELD_LEN);
}

export function parseNavigationRoutes(raw: string | null): NavigationRoute[] {
  if (!raw) {
    return [];
  }

  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) {
      return [];
    }

    const out: NavigationRoute[] = [];

    for (const item of data) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const rec = item as Record<string, unknown>;
      const id = typeof rec.id === "string" ? rec.id.trim().slice(0, 128) : "";
      const from = sanitizeRouteField(rec.from);
      const to = sanitizeRouteField(rec.to);

      if (!id || !to) {
        continue;
      }

      out.push({ id, from, to });
      if (out.length >= MAX_NAVIGATION_ROUTES) {
        break;
      }
    }

    return out;
  } catch {
    return [];
  }
}

export function newNavigationRouteId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
