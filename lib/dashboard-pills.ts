/** Aligns with panel border accents & rail segments (#systems overview orange, radar peach, etc.). */
export type PillAccent = "gold" | "blue" | "peach" | "purple" | "orange";

export type ControlPill = {
  label: string;
  /** DOM id (no `#`) to scroll to and flash */
  targetId: string;
  accent: PillAccent;
};

/** One pill per dashboard panel; labels match panel headings (see components). */
export const CONTROL_PILLS: ControlPill[] = [
  { label: "Station Time", targetId: "clock", accent: "orange" },
  { label: "Atmospheric Scan", targetId: "weather", accent: "orange" },
  { label: "Market Telemetry", targetId: "markets", accent: "orange" },
  { label: "Market Core", targetId: "watchlist", accent: "gold" },
  { label: "Quick Links", targetId: "bookmarks", accent: "gold" },
  { label: "Weather Radar", targetId: "radar", accent: "peach" },
  { label: "Traffic", targetId: "traffic", accent: "purple" },
  { label: "Subspace Feed", targetId: "news", accent: "blue" },
];

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
