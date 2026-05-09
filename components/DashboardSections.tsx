"use client";

import { useEffect, useState } from "react";

import { BookmarksPanel } from "@/components/BookmarksPanel";
import { ClockPanel } from "@/components/ClockPanel";
import { LocalMapPanel } from "@/components/LocalMapPanels";
import { LcarsRailHeights } from "@/components/LcarsRailHeights";
import { LcarsRailNav } from "@/components/LcarsRailNav";
import { MarketPanel } from "@/components/MarketPanel";
import { NewsPanel } from "@/components/NewsPanel";
import { WatchlistPanel } from "@/components/WatchlistPanel";
import { WeatherPanel } from "@/components/WeatherPanel";
import {
  DASHBOARD_SECTION_ORDER_STORAGE_KEY,
  DEFAULT_DASHBOARD_SECTION_ORDER,
  restoreDashboardSectionOrder,
  type DashboardSectionId,
} from "@/lib/dashboard-sections";
import type { WeatherReport } from "@/lib/weather";

type DashboardSectionsProps = {
  initialWeatherReport: WeatherReport;
};

export function DashboardSections({ initialWeatherReport }: DashboardSectionsProps) {
  const [sectionOrder, setSectionOrder] = useState<DashboardSectionId[]>(() => [...DEFAULT_DASHBOARD_SECTION_ORDER]);
  const [railDragUnlocked, setRailDragUnlocked] = useState(false);

  function onRailReorder(fromIndex: number, toIndex: number) {
    setSectionOrder((items) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
        return items;
      }
      if (fromIndex >= items.length || toIndex >= items.length) {
        return items;
      }
      const next = [...items];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  useEffect(() => {
    const oldRailOrder = window.localStorage.getItem("kewldashboard.railOrder.v1");
    const savedOrder = window.localStorage.getItem(DASHBOARD_SECTION_ORDER_STORAGE_KEY) ?? oldRailOrder;
    setSectionOrder(restoreDashboardSectionOrder(savedOrder));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_SECTION_ORDER_STORAGE_KEY, JSON.stringify(sectionOrder));
    window.dispatchEvent(new Event("kewldashboard:rail-order-change"));
  }, [sectionOrder]);

  /** Leaflet maps break when their container is reparented (section drag-reorder). Remount maps when order changes. */
  const mapRemountKey = sectionOrder.join("|");

  function renderSection(sectionId: DashboardSectionId) {
    switch (sectionId) {
      case "systems":
        return (
          <section key={sectionId} id="systems" className="top-grid scroll-target" aria-label="Operations">
            <ClockPanel />
            <WeatherPanel initialReport={initialWeatherReport} />
            <MarketPanel />
          </section>
        );
      case "watchlist":
        return <WatchlistPanel key={sectionId} />;
      case "bookmarks":
        return <BookmarksPanel key={sectionId} />;
      case "radar":
        return <LocalMapPanel key={`radar:${mapRemountKey}`} variant="radar" />;
      case "traffic":
        return <LocalMapPanel key={`traffic:${mapRemountKey}`} variant="navigation" />;
      case "news":
        return <NewsPanel key={sectionId} />;
    }
  }

  return (
    <>
      <LcarsRailHeights />
      <LcarsRailNav
        order={sectionOrder}
        onRailReorder={onRailReorder}
        dragUnlocked={railDragUnlocked}
        onDragUnlockedChange={setRailDragUnlocked}
      />
      <div className="dashboard-main">{sectionOrder.map(renderSection)}</div>
    </>
  );
}
