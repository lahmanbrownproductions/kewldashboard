"use client";

import { useMemo } from "react";

import { useDashboardLocation } from "@/components/dashboard-location-context";

export function LocalMapPanels() {
  const { location } = useDashboardLocation();

  const rainViewerSrc = useMemo(() => {
    const zoom = 8;
    const { latitude: lat, longitude: lon } = location;
    return `https://www.rainviewer.com/map.html?loc=${lat},${lon},${zoom}&oFa=0&oC=0&oU=1&oCS=1&oF=1&oAP=1&c=1&o=83&lm=1&layer=radar&sm=1&sn=1`;
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
          <strong>RainViewer Live</strong>
        </div>
        <iframe
          key={`radar-${location.latitude}-${location.longitude}`}
          title={`RainViewer radar near ${areaLabel}`}
          src={rainViewerSrc}
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
