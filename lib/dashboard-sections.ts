export const DASHBOARD_SECTION_DEFS = [
  { id: "systems", label: "Overview", className: "rail-segment rail-orange" },
  { id: "watchlist", label: "Systems", className: "rail-segment rail-gold" },
  { id: "bookmarks", label: "Links", className: "rail-segment rail-links" },
  { id: "radar", label: "Radar", className: "rail-segment rail-peach" },
  { id: "traffic", label: "Navigation", className: "rail-segment rail-purple" },
  { id: "news", label: "News", className: "rail-segment rail-blue" },
] as const;

export type DashboardSectionId = (typeof DASHBOARD_SECTION_DEFS)[number]["id"];
export type DashboardSectionDef = (typeof DASHBOARD_SECTION_DEFS)[number];

export const DEFAULT_DASHBOARD_SECTION_ORDER = DASHBOARD_SECTION_DEFS.map((section) => section.id);
export const DASHBOARD_SECTION_ORDER_STORAGE_KEY = "kewldashboard.sectionOrder.v1";

export function restoreDashboardSectionOrder(saved: string | null): DashboardSectionId[] {
  if (!saved) {
    return [...DEFAULT_DASHBOARD_SECTION_ORDER];
  }

  try {
    const ids = JSON.parse(saved) as unknown;
    if (!Array.isArray(ids)) {
      return [...DEFAULT_DASHBOARD_SECTION_ORDER];
    }

    const allowedIds = new Set<DashboardSectionId>(DEFAULT_DASHBOARD_SECTION_ORDER);
    const restored = ids.filter(
      (id): id is DashboardSectionId => typeof id === "string" && allowedIds.has(id as DashboardSectionId),
    );
    const restoredIds = new Set(restored);
    const missing = DEFAULT_DASHBOARD_SECTION_ORDER.filter((id) => !restoredIds.has(id));

    return restored.length > 0 ? [...restored, ...missing] : [...DEFAULT_DASHBOARD_SECTION_ORDER];
  } catch {
    window.localStorage.removeItem(DASHBOARD_SECTION_ORDER_STORAGE_KEY);
    return [...DEFAULT_DASHBOARD_SECTION_ORDER];
  }
}
