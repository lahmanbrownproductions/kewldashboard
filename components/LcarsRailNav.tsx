"use client";

import { scrollToDashboardTarget } from "@/lib/dashboard-pills";

const RAIL_LINKS = [
  { href: "#systems", label: "Overview", className: "rail-segment rail-orange" },
  { href: "#watchlist", label: "Systems", className: "rail-segment rail-gold" },
  { href: "#radar", label: "Radar", className: "rail-segment rail-peach" },
  { href: "#traffic", label: "Traffic", className: "rail-segment rail-purple" },
  { href: "#news", label: "News", className: "rail-segment rail-blue" },
] as const;

function targetIdFromHref(href: string): string {
  return href.startsWith("#") ? href.slice(1) : href;
}

export function LcarsRailNav() {
  return (
    <nav className="lcars-rail" aria-label="Dashboard sections">
      <div className="rail-top-block" aria-hidden="true" />
      {RAIL_LINKS.map((item) => (
        <a
          key={`${item.href}-${item.label}`}
          className={item.className}
          href={item.href}
          onClick={(event) => {
            event.preventDefault();
            scrollToDashboardTarget(targetIdFromHref(item.href));
          }}
        >
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}
