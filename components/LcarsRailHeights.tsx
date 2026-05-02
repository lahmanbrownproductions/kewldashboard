"use client";

import { useEffect } from "react";

const RAIL_SELECTOR = ".lcars-rail";

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
    const mqWideMaps = window.matchMedia("(min-width: 1181px)");

    function apply() {
      if (!mqDesktop.matches) {
        railEl.style.removeProperty("grid-template-rows");
        return;
      }

      const systems = document.getElementById("systems");
      const watchlist = document.getElementById("watchlist");
      const mapPanels = document.getElementById("map-panels");
      const radar = document.getElementById("radar");
      const traffic = document.getElementById("traffic");
      const news = document.getElementById("news");

      const minSeg = 52;
      const hOverview = Math.max(readHeight(systems), minSeg);
      const hSystems = Math.max(readHeight(watchlist), minSeg);

      let hRadar: number;
      let hTraffic: number;
      if (mqWideMaps.matches && mapPanels) {
        const total = readHeight(mapPanels);
        hRadar = Math.max(Math.floor(total / 2), minSeg);
        hTraffic = Math.max(total - hRadar, minSeg);
      } else {
        hRadar = Math.max(readHeight(radar), minSeg);
        hTraffic = Math.max(readHeight(traffic), minSeg);
      }

      const hNews = Math.max(readHeight(news), minSeg);

      railEl.style.gridTemplateRows = [
        "2.3rem",
        `${hOverview}px`,
        `${hSystems}px`,
        `${hRadar}px`,
        `${hTraffic}px`,
        `${hNews}px`,
      ].join(" ");
    }

    function schedule() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    }

    function getSectionElements(): HTMLElement[] {
      const ids = ["systems", "watchlist", "map-panels", "radar", "traffic", "news"] as const;
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
    mqDesktop.addEventListener("change", schedule);
    mqWideMaps.addEventListener("change", schedule);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
      mqDesktop.removeEventListener("change", schedule);
      mqWideMaps.removeEventListener("change", schedule);
      railEl.style.removeProperty("grid-template-rows");
    };
  }, []);

  return null;
}
