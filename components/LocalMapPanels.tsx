"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import { useDashboardLocation } from "@/components/dashboard-location-context";

const DashboardLeafletMap = dynamic(
  () =>
    import("@/components/maps/DashboardLeafletMap").then((m) => m.DashboardLeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="map-frame map-frame-loading" role="status">
        Loading map…
      </div>
    ),
  },
);

export function LocalMapPanels() {
  const { location } = useDashboardLocation();

  const center = useMemo(
    (): [number, number] => [location.latitude, location.longitude],
    [location.latitude, location.longitude],
  );

  const areaLabel = location.label;

  return (
    <section id="map-panels" className="mission-grid scroll-target" aria-label="Operational panels">
      <article id="radar" className="panel map-panel radar-panel scroll-target">
        <div className="panel-heading">
          <span>Weather Radar</span>
          <strong className="map-panel-attribution">
            <a href="https://www.rainviewer.com/api.html" target="_blank" rel="noreferrer noopener">
              RainViewer
            </a>
            {" · "}
            <a href="https://carto.com/attributions" target="_blank" rel="noreferrer noopener">
              CARTO
            </a>
          </strong>
        </div>
        <div className="map-frame map-frame-leaflet">
          <DashboardLeafletMap center={center} variant="radar" areaLabel={areaLabel} zoom={6} />
        </div>
      </article>

      <article id="traffic" className="panel map-panel traffic-panel scroll-target">
        <div className="panel-heading">
          <span>Traffic</span>
          <strong className="map-panel-attribution">Basemap · optional tile layer</strong>
        </div>
        <div className="map-frame map-frame-leaflet">
          <DashboardLeafletMap center={center} variant="traffic" areaLabel={areaLabel} zoom={11} />
        </div>
      </article>
    </section>
  );
}
