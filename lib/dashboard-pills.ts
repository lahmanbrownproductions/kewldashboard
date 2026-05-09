import {
  DEFAULT_DASHBOARD_SECTION_ORDER,
  type DashboardSectionId,
} from "@/lib/dashboard-sections";

/** Aligns with panel border accents & rail segments (#systems / Ops orange, radar peach, etc.). */
export type PillAccent = "gold" | "blue" | "peach" | "purple" | "orange";

export type ControlPill = {
  label: string;
  /** DOM id (no `#`) to scroll to and flash */
  targetId: string;
  accent: PillAccent;
};

const SYSTEMS_PILLS: ControlPill[] = [
  { label: "Station Time", targetId: "clock", accent: "orange" },
  { label: "Atmospheric Scan", targetId: "weather", accent: "orange" },
  { label: "Market Telemetry", targetId: "markets", accent: "orange" },
];

const PILLS_BY_SECTION: Record<DashboardSectionId, ControlPill[]> = {
  systems: SYSTEMS_PILLS,
  watchlist: [{ label: "Market Core", targetId: "watchlist", accent: "gold" }],
  bookmarks: [{ label: "Quick Links", targetId: "bookmarks", accent: "gold" }],
  radar: [
    { label: "Sky", targetId: "science-sky", accent: "peach" },
    { label: "SpaceX", targetId: "spacex-launches", accent: "peach" },
    { label: "Weather Radar", targetId: "radar-map", accent: "peach" },
  ],
  traffic: [{ label: "Navigation", targetId: "traffic", accent: "purple" }],
  news: [{ label: "Subspace Feed", targetId: "news", accent: "blue" }],
};

/** Pills in header follow the same section order as the LCARS sidebar (multi-panel sections expand inline). */
export function controlPillsForSectionOrder(order: DashboardSectionId[]): ControlPill[] {
  const result: ControlPill[] = [];
  for (const id of order) {
    const pills = PILLS_BY_SECTION[id];
    if (pills) {
      result.push(...pills);
    }
  }
  return result;
}

/** Default-order list; use {@link controlPillsForSectionOrder} when sidebar order is known. */
export const CONTROL_PILLS = controlPillsForSectionOrder([...DEFAULT_DASHBOARD_SECTION_ORDER]);

const FLASH_CLASS = "panel-focus-flash";
const FLASH_FALLBACK_MS = 1200;

export function scrollToDashboardTarget(targetId: string) {
  if (typeof document === "undefined") {
    return;
  }

  const el = document.getElementById(targetId);
  if (!el) {
    return;
  }

  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });

  el.classList.remove(FLASH_CLASS);
  void el.offsetWidth;
  el.classList.add(FLASH_CLASS);

  const cleanup = () => el.classList.remove(FLASH_CLASS);
  el.addEventListener("animationend", cleanup, { once: true });
  window.setTimeout(cleanup, FLASH_FALLBACK_MS);

  try {
    history.replaceState(null, "", `#${targetId}`);
  } catch {
    /* ignore */
  }
}
