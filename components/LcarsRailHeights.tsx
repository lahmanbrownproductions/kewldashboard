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
        const section = sectionId ? document.getElementById(sectionId) : null;
        return `${Math.max(readHeight(section), minSeg)}px`;
      });

      railEl.style.gridTemplateRows = ["2.3rem", ...rows].join(" ");
    }

    function schedule() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    }

    function getSectionElements(): HTMLElement[] {
      const ids = ["systems", "watchlist", "bookmarks", "radar", "traffic", "news"] as const;
      const list: HTMLElement[] = [];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) {
          list.push(el);
        }
      }
      return list;
    }

    apply();

    const ro = new ResizeObserver(schedule);
    for (const el of getSectionElements()) {
      ro.observe(el);
    }

    const main = document.querySelector(".dashboard-main");
    if (main) {
      ro.observe(main);
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
