"use client";

import { useEffect } from "react";

const RAIL_SELECTOR = ".lcars-rail";
const RAIL_SECTION_SELECTOR = ".rail-segment[data-section-id]";

function readHeight(el: Element | null): number {
  if (!el) {
    return 0;
  }
  return Math.round(el.getBoundingClientRect().height);
}

/** Row grid item that stretches with multi-column rows; inner #id may be shorter than the shared row. */
function getRailHeightAnchor(sectionId: string | undefined): HTMLElement | null {
  if (!sectionId) {
    return null;
  }
  const inner = document.getElementById(sectionId);
  if (!inner) {
    return null;
  }
  return inner.closest(".dashboard-layout-cell") ?? inner;
}

export function LcarsRailHeights() {
  useEffect(() => {
    const rail = document.querySelector<HTMLElement>(RAIL_SELECTOR);
    if (!rail) {
      return;
    }

    const railEl = rail;

    let raf = 0;
    const mqDesktop = window.matchMedia("(min-width: 761px)");

    function apply() {
      if (!mqDesktop.matches) {
        railEl.style.removeProperty("grid-template-rows");
        return;
      }

      const minSeg = 52;
      const rows = Array.from(railEl.querySelectorAll<HTMLElement>(RAIL_SECTION_SELECTOR)).map((segment) => {
        const sectionId = segment.dataset.sectionId;
        const anchor = getRailHeightAnchor(sectionId ?? undefined);
        return `${Math.max(readHeight(anchor), minSeg)}px`;
      });

      railEl.style.gridTemplateRows = ["2.3rem", ...rows].join(" ");
    }

    function schedule() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    }

    function getResizeObservedElements(): HTMLElement[] {
      const ids = ["systems", "watchlist", "bookmarks", "radar", "traffic", "news"] as const;
      const anchors = new Set<HTMLElement>();

      for (const id of ids) {
        const anchor = getRailHeightAnchor(id);
        if (anchor) {
          anchors.add(anchor);
        }
      }

      for (const row of document.querySelectorAll(".dashboard-layout-row")) {
        anchors.add(row as HTMLElement);
      }

      const main = document.querySelector(".dashboard-main");
      if (main) {
        anchors.add(main as HTMLElement);
      }

      return [...anchors];
    }

    apply();

    const ro = new ResizeObserver(schedule);
    for (const el of getResizeObservedElements()) {
      ro.observe(el);
    }
    window.addEventListener("resize", schedule);
    window.addEventListener("kewldashboard:rail-order-change", schedule);
    mqDesktop.addEventListener("change", schedule);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("kewldashboard:rail-order-change", schedule);
      mqDesktop.removeEventListener("change", schedule);
      railEl.style.removeProperty("grid-template-rows");
    };
  }, []);

  return null;
}
