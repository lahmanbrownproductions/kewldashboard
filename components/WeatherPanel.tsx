"use client";

import { useEffect, useId, useState } from "react";

import { useDashboardLocation } from "@/components/dashboard-location-context";
import type { WeatherReport } from "@/lib/weather";

type WeatherPanelProps = {
  initialReport: WeatherReport;
};

export function WeatherPanel({ initialReport }: WeatherPanelProps) {
  const { location } = useDashboardLocation();
  const [report, setReport] = useState<WeatherReport>(initialReport);
  const [advisoryOpen, setAdvisoryOpen] = useState(false);
  const advisoryRegionId = useId();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const params = new URLSearchParams({
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        timezone: location.timezone,
      });

      const response = await fetch(`/api/weather?${params}`);

      if (!response.ok || cancelled) {
        return;
      }

      const data = (await response.json()) as WeatherReport;
      if (!cancelled) {
        setReport(data);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [location.latitude, location.longitude, location.timezone]);

  return (
    <section
      id="weather"
      className="panel widget-panel weather-panel scroll-target"
      aria-label={`${location.label} weather report`}
    >
      <div className="panel-heading">
        <span>Atmospheric Scan</span>
        <div className="weather-panel-heading-meta">
          <strong>{location.label}</strong>
          <button
            type="button"
            className="weather-panel-info-toggle"
            aria-expanded={advisoryOpen}
            aria-controls={advisoryRegionId}
            title="Weather data sources and limitations"
            onClick={() => setAdvisoryOpen((open) => !open)}
          >
            i
          </button>
        </div>
      </div>

      <div className="weather-current">
        <div>
          <p className="weather-temp">{report.temperature}°</p>
          <p className="weather-condition">{report.condition}</p>
        </div>
        <div className="weather-metrics" aria-label="Current weather metrics">
          <span>Feels {report.apparentTemperature}°</span>
          <span>Humidity {report.humidity}%</span>
          <span>Wind {report.windSpeed} mph</span>
          <span>Rain {report.precipitation.toFixed(2)} in</span>
        </div>
      </div>

      <div id="weather-forecast" className="forecast-strip scroll-target" aria-label="Four day forecast">
        {report.daily.map((day) => (
          <article key={day.day}>
            <span>{day.day}</span>
            <strong>{day.high}°</strong>
            <small>{day.low}° low</small>
            <small>{day.rainChance}% rain</small>
          </article>
        ))}
      </div>

      {advisoryOpen ? (
        <div id={advisoryRegionId} className="weather-panel-advisory" role="region" aria-label="Sensor caveat">
          <p className="weather-panel-advisory-eyebrow">Operations · sensor caveat</p>
          <p className="weather-panel-advisory-copy">
            Atmospheric digest above is LCARS summary telemetry only. The Weather Radar chart carries RainViewer
            radar and optional precip/cloud tiles when available; lightning, shear profiles, and
            hazardous-weather polygons still route through external relays (Windy / NWS from that chart).
          </p>
        </div>
      ) : null}
    </section>
  );
}
