"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import { useDashboardLocation } from "@/components/dashboard-location-context";

type LocalMapPanelProps = {
  variant: "radar" | "navigation";
};

const DashboardLeafletMap = dynamic(
  () =>
    import("@/components/maps/DashboardLeafletMap").then((m) => m.DashboardLeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="map-frame map-frame-loading" role="status">
        Loading map...
      </div>
    ),
  },
);

export function LocalMapPanel({ variant }: LocalMapPanelProps) {
  const { location } = useDashboardLocation();

  const center = useMemo(
    (): [number, number] => [location.latitude, location.longitude],
    [location.latitude, location.longitude],
  );

  const areaLabel = location.label;
  const isRadar = variant === "radar";

  return (
    <article
      id={isRadar ? variant : "traffic"}
      className={`panel map-panel ${isRadar ? "radar-panel" : "navigation-panel"} scroll-target`}
    >
      <div className="panel-heading">
        <span>{isRadar ? "Weather Radar" : "Navigation"}</span>
        <strong className="map-panel-attribution">
          {isRadar ? (
            <>
              <a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer noopener">
                RainViewer
              </a>
              {" - "}
              <a href="https://carto.com/attributions" target="_blank" rel="noreferrer noopener">
                CARTO
              </a>
              {" - "}Optional OpenWeather overlays - meteorological relays - centered on your station
            </>
          ) : (
            "Saved routes open in Google Maps — wheelhouse chart centered on your station"
          )}
        </strong>
      </div>
      <div className="map-frame map-frame-leaflet">
        <DashboardLeafletMap center={center} variant={variant} areaLabel={areaLabel} zoom={isRadar ? 6 : 11} />
      </div>
    </article>
  );
}

export function LocalMapPanels() {
  return (
    <section id="map-panels" className="mission-grid scroll-target" aria-label="Operational panels">
      <LocalMapPanel variant="radar" />
      <LocalMapPanel variant="navigation" />
    </section>
  );
}
