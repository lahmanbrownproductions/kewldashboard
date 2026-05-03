"use client";

import { useMemo } from "react";

import { useDashboardLocation } from "@/components/dashboard-location-context";

/** Windy iframe: fewer fixed overlays than RainViewer (logo pill + live/time bar). Embed ToS still apply. */
function windyRadarEmbedUrl(latitude: number, longitude: number, zoom: number): string {
  const lat = latitude.toFixed(4);
  const lon = longitude.toFixed(4);
  const qs = new URLSearchParams([
    ["lat", lat],
    ["lon", lon],
    ["detailLat", lat],
    ["detailLon", lon],
    ["zoom", String(zoom)],
    ["level", "surface"],
    ["overlay", "radar"],
    ["type", "map"],
    ["location", "coordinates"],
    ["calendar", "now"],
    ["pressure", ""],
    ["marker", ""],
    ["menu", ""],
    ["message", ""],
    ["detail", "false"],
    ["metricWind", "mph"],
    ["metricTemp", "°F"],
  ]);
  return `https://embed.windy.com/embed2.html?${qs.toString()}`;
}

export function LocalMapPanels() {
  const { location } = useDashboardLocation();

  const radarSrc = useMemo(() => {
    const zoom = 8;
    return windyRadarEmbedUrl(location.latitude, location.longitude, zoom);
  }, [location.latitude, location.longitude]);

  const wazeSrc = useMemo(() => {
    const { latitude: lat, longitude: lon } = location;
    return `https://embed.waze.com/iframe?zoom=10&lat=${lat}&lon=${lon}&ct=livemap&pin=1`;
  }, [location.latitude, location.longitude]);

  const areaLabel = location.label;

  return (
    <section id="map-panels" className="mission-grid scroll-target" aria-label="Operational panels">
      <article id="radar" className="panel map-panel radar-panel scroll-target">
        <div className="panel-heading">
          <span>Weather Radar</span>
          <strong className="map-panel-attribution">
            <a href="https://www.windy.com" target="_blank" rel="noreferrer noopener">
              Windy
            </a>
          </strong>
        </div>
        <iframe
          key={`radar-${location.latitude}-${location.longitude}`}
          title={`Radar near ${areaLabel}`}
          src={radarSrc}
          className="map-frame"
          loading="lazy"
          allowFullScreen
        />
      </article>

      <article id="traffic" className="panel map-panel traffic-panel scroll-target">
        <div className="panel-heading">
          <span>Traffic</span>
          <strong>Waze Live Map</strong>
        </div>
        <iframe
          key={`traffic-${location.latitude}-${location.longitude}`}
          title={`Waze traffic near ${areaLabel}`}
          src={wazeSrc}
          className="map-frame traffic-frame"
          loading="lazy"
          allowFullScreen
        />
      </article>
    </section>
  );
}
