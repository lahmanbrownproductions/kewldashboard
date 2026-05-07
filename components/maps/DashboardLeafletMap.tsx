"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Pane, TileLayer } from "react-leaflet";

import { MapResizeFix } from "@/components/maps/MapResizeFix";
import { MapViewUpdater } from "@/components/maps/MapViewUpdater";
import {
  CARTO_DARK_ATTRIBUTION,
  CARTO_DARK_TILE_URL,
  OPENWEATHER_MAP_ATTRIBUTION,
  RAINVIEWER_ATTRIBUTION,
} from "@/lib/maps/basemap";
import { getOpenWeatherMapApiKey } from "@/lib/maps/map-env";
import { openWeatherCloudsTileUrl, openWeatherPrecipitationTileUrl } from "@/lib/maps/open-weather-tiles";
import {
  coverageTileUrlTemplate,
  fetchRainViewerMaps,
  getLatestRadarFrame,
  radarTileUrlTemplate,
} from "@/lib/maps/rainviewer";

import "./dashboard-leaflet-map.css";

/** Leaflet supports this on `L.Map`; react-leaflet's `MapContainerProps` typings omit `zoomControlOptions`. */
const MAP_ZOOM_BOTTOM_RIGHT = {
  zoomControl: true,
  zoomControlOptions: { position: "bottomright" as const },
} as const;

export type DashboardLeafletMapVariant = "radar" | "traffic";

export type DashboardLeafletMapProps = {
  center: [number, number];
  zoom?: number;
  areaLabel: string;
  variant: DashboardLeafletMapVariant;
};

const RADAR_NATIVE_MAX_ZOOM = 7;
const RAINVIEWER_REFRESH_MS = 10 * 60 * 1000;

function clampZoom(zoom: number, max: number) {
  return Math.min(Math.max(zoom, 2), max);
}

function TrafficDashboardLeafletMap({ center, zoom, areaLabel }: Omit<DashboardLeafletMapProps, "variant">) {
  const lat = center[0];
  const lng = center[1];
  const stationCenter: [number, number] = [lat, lng];

  const defaultZoom = 11;
  const requestedZoom = zoom ?? defaultZoom;
  const maxUiZoom = 18;
  const viewZoom = clampZoom(requestedZoom, maxUiZoom);
  const relayZoom = Math.min(18, Math.max(10, Math.round(viewZoom)));

  const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&zoom=${relayZoom}&navigate=yes`;
  const googleMapsTrafficUrl = `https://www.google.com/maps/@${lat},${lng},${relayZoom}z/data=!5m1!1e1`;

  return (
    <div className="leaflet-map-shell" aria-label={`Map near ${areaLabel}`}>
      <div className="map-overlay-toolbar" role="toolbar" aria-label="Helm relays">
        <a
          className="map-layer-toggle map-layer-toggle--link is-on"
          href={wazeUrl}
          target="_blank"
          rel="noreferrer noopener"
          title="Open Waze (helm relay)"
        >
          Waze
        </a>
        <a
          className="map-layer-toggle map-layer-toggle--link is-on"
          href={googleMapsTrafficUrl}
          target="_blank"
          rel="noreferrer noopener"
          title="Open Maps with traffic layer"
        >
          Maps
        </a>
      </div>

      <div className="map-helm-advisory-overlay" aria-live="polite">
        <div className="map-helm-advisory-panel map-helm-advisory-panel--traffic">
          <p className="map-helm-advisory-eyebrow">Mission ops · channel limitation</p>
          <p className="map-helm-advisory-title">Live traffic not on main viewer</p>
          <p className="map-helm-advisory-copy">
            Shipboard LCARS resolves cartography only — congestion telemetry is not mirrored aboard this
            terminal. Establish an&nbsp;
            <span className="map-helm-advisory-em">off-ship navigation relay</span> via the helm shortcuts
            above.
          </p>
        </div>
      </div>

      <MapContainer
        center={stationCenter}
        zoom={viewZoom}
        maxZoom={18}
        minZoom={2}
        className="dashboard-leaflet-map"
        scrollWheelZoom
        {...MAP_ZOOM_BOTTOM_RIGHT}
      >
        <TileLayer
          url={CARTO_DARK_TILE_URL}
          attribution={CARTO_DARK_ATTRIBUTION}
          maxZoom={20}
          subdomains="abcd"
        />

        <Pane name="station-marker" style={{ zIndex: 650 }}>
          <CircleMarker
            center={stationCenter}
            radius={9}
            pathOptions={{
              color: "#f5c96b",
              weight: 2,
              fillColor: "#c97e5f",
              fillOpacity: 0.55,
            }}
          />
        </Pane>

        <MapResizeFix />
        <MapViewUpdater center={stationCenter} zoom={viewZoom} />
      </MapContainer>
    </div>
  );
}

function RadarDashboardLeafletMap({ center, zoom, areaLabel }: Omit<DashboardLeafletMapProps, "variant">) {
  const lat = center[0];
  const lng = center[1];
  const stationCenter: [number, number] = [lat, lng];

  const defaultZoom = 6;
  const requestedZoom = zoom ?? defaultZoom;
  const maxUiZoom = RADAR_NATIVE_MAX_ZOOM;
  const viewZoom = clampZoom(requestedZoom, maxUiZoom);

  const windyUrl = `https://www.windy.com/${lat}/${lng}`;
  const nwsUrl = `https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lng}`;

  const openWeatherKey = useMemo(() => getOpenWeatherMapApiKey(), []);

  const [rainMaps, setRainMaps] = useState<Awaited<ReturnType<typeof fetchRainViewerMaps>>>(null);
  const [rainFetchFailed, setRainFetchFailed] = useState(false);
  const [showRadar, setShowRadar] = useState(true);
  const [showCoverage, setShowCoverage] = useState(false);
  const [showPrecip, setShowPrecip] = useState(false);
  const [showClouds, setShowClouds] = useState(false);

  const refreshRainViewer = useCallback(async () => {
    const maps = await fetchRainViewerMaps();
    if (maps) {
      setRainMaps(maps);
      setRainFetchFailed(false);
    } else {
      setRainFetchFailed(true);
    }
  }, []);

  useEffect(() => {
    void refreshRainViewer();
    const id = window.setInterval(() => {
      void refreshRainViewer();
    }, RAINVIEWER_REFRESH_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [refreshRainViewer]);

  const latestFrame = useMemo(() => (rainMaps ? getLatestRadarFrame(rainMaps) : null), [rainMaps]);

  const radarTileUrl =
    rainMaps && latestFrame ? radarTileUrlTemplate(rainMaps.host, latestFrame.path, 512) : null;
  const coverageTileUrl = rainMaps ? coverageTileUrlTemplate(rainMaps.host, 512) : null;

  const precipTileUrl = openWeatherKey ? openWeatherPrecipitationTileUrl(openWeatherKey) : null;
  const cloudsTileUrl = openWeatherKey ? openWeatherCloudsTileUrl(openWeatherKey) : null;

  const radarLayerKey = latestFrame ? String(latestFrame.time) : "radar";

  const radarUnavailable = !radarTileUrl;
  const coverageUnavailable = !coverageTileUrl;

  const toggleRadar = () => setShowRadar((v) => !v);
  const toggleCoverage = () => setShowCoverage((v) => !v);
  const togglePrecip = () => setShowPrecip((v) => !v);
  const toggleClouds = () => setShowClouds((v) => !v);

  return (
    <div className="leaflet-map-shell" aria-label={`Map near ${areaLabel}`}>
      <div
        className="map-overlay-toolbar"
        role="toolbar"
        aria-label="Radar overlays and meteorological relays"
      >
        <button
          type="button"
          className={`map-layer-toggle${showRadar ? " is-on" : ""}`}
          aria-pressed={showRadar}
          disabled={radarUnavailable}
          title={
            radarUnavailable
              ? "RainViewer radar unavailable — use Windy / NWS relays"
              : "RainViewer composite radar"
          }
          onClick={toggleRadar}
        >
          Radar
        </button>
        <button
          type="button"
          className={`map-layer-toggle${showCoverage ? " is-on" : ""}`}
          aria-pressed={showCoverage}
          disabled={coverageUnavailable}
          title={coverageUnavailable ? "Coverage mask requires RainViewer metadata" : "Radar coverage mask"}
          onClick={toggleCoverage}
        >
          Coverage
        </button>
        <button
          type="button"
          className={`map-layer-toggle${showPrecip ? " is-on" : ""}`}
          aria-pressed={showPrecip}
          disabled={!precipTileUrl}
          title={
            precipTileUrl
              ? "OpenWeather precipitation layer"
              : "Set NEXT_PUBLIC_OPENWEATHERMAP_API_KEY for precip tiles"
          }
          onClick={togglePrecip}
        >
          Precip
        </button>
        <button
          type="button"
          className={`map-layer-toggle${showClouds ? " is-on" : ""}`}
          aria-pressed={showClouds}
          disabled={!cloudsTileUrl}
          title={
            cloudsTileUrl
              ? "OpenWeather clouds layer"
              : "Set NEXT_PUBLIC_OPENWEATHERMAP_API_KEY for cloud tiles"
          }
          onClick={toggleClouds}
        >
          Clouds
        </button>
        <a
          className="map-layer-toggle map-layer-toggle--link is-on"
          href={windyUrl}
          target="_blank"
          rel="noreferrer noopener"
          title="Open Windy — live wind & radar layers"
        >
          Windy
        </a>
        <a
          className="map-layer-toggle map-layer-toggle--link is-on"
          href={nwsUrl}
          target="_blank"
          rel="noreferrer noopener"
          title="National Weather Service forecast & radar"
        >
          NWS
        </a>
      </div>

      {rainFetchFailed && radarUnavailable ? (
        <div className="map-leaflet-banner" role="status">
          Radar metadata unavailable — enable relays (Windy / NWS) for full sweep.
        </div>
      ) : null}

      <div className="map-helm-advisory-overlay" aria-live="polite">
        <div className="map-helm-advisory-panel map-helm-advisory-panel--radar">
          <p className="map-helm-advisory-eyebrow">Science division · atmospheric relay</p>
          <p className="map-helm-advisory-title">Hybrid meteorological display</p>
          <p className="map-helm-advisory-copy">
            Composite radar (RainViewer) and optional precip/cloud tiles stream aboard when available.
            Lightning meshes, NWS warning polygons, mesoscale modeling, and ensemble forecasts are not fully
            mirrored here — establish a&nbsp;
            <span className="map-helm-advisory-em">meteorological relay</span> via Windy or NWS above.
          </p>
        </div>
      </div>

      <MapContainer
        center={stationCenter}
        zoom={viewZoom}
        maxZoom={RADAR_NATIVE_MAX_ZOOM}
        minZoom={2}
        className="dashboard-leaflet-map"
        scrollWheelZoom
        {...MAP_ZOOM_BOTTOM_RIGHT}
      >
        <TileLayer
          url={CARTO_DARK_TILE_URL}
          attribution={CARTO_DARK_ATTRIBUTION}
          maxZoom={20}
          maxNativeZoom={20}
          subdomains="abcd"
        />

        {showCoverage && coverageTileUrl ? (
          <Pane name="rainviewer-coverage" style={{ zIndex: 380 }}>
            <TileLayer
              url={coverageTileUrl}
              attribution={RAINVIEWER_ATTRIBUTION}
              opacity={0.38}
              maxZoom={RADAR_NATIVE_MAX_ZOOM}
              maxNativeZoom={RADAR_NATIVE_MAX_ZOOM}
            />
          </Pane>
        ) : null}

        {showRadar && radarTileUrl ? (
          <Pane name="rainviewer-radar" style={{ zIndex: 390 }}>
            <TileLayer
              key={radarLayerKey}
              url={radarTileUrl}
              attribution={RAINVIEWER_ATTRIBUTION}
              opacity={0.78}
              maxZoom={RADAR_NATIVE_MAX_ZOOM}
              maxNativeZoom={RADAR_NATIVE_MAX_ZOOM}
            />
          </Pane>
        ) : null}

        {showPrecip && precipTileUrl ? (
          <Pane name="openweather-precip" style={{ zIndex: 400 }}>
            <TileLayer
              url={precipTileUrl}
              attribution={OPENWEATHER_MAP_ATTRIBUTION}
              opacity={0.55}
              maxZoom={RADAR_NATIVE_MAX_ZOOM}
              maxNativeZoom={18}
            />
          </Pane>
        ) : null}

        {showClouds && cloudsTileUrl ? (
          <Pane name="openweather-clouds" style={{ zIndex: 410 }}>
            <TileLayer
              url={cloudsTileUrl}
              attribution={OPENWEATHER_MAP_ATTRIBUTION}
              opacity={0.45}
              maxZoom={RADAR_NATIVE_MAX_ZOOM}
              maxNativeZoom={18}
            />
          </Pane>
        ) : null}

        <Pane name="station-marker" style={{ zIndex: 650 }}>
          <CircleMarker
            center={stationCenter}
            radius={9}
            pathOptions={{
              color: "#f5c96b",
              weight: 2,
              fillColor: "#c97e5f",
              fillOpacity: 0.55,
            }}
          />
        </Pane>

        <MapResizeFix />
        <MapViewUpdater center={stationCenter} zoom={viewZoom} />
      </MapContainer>
    </div>
  );
}

export function DashboardLeafletMap(props: DashboardLeafletMapProps) {
  const { variant, ...rest } = props;
  return variant === "radar" ? (
    <RadarDashboardLeafletMap {...rest} />
  ) : (
    <TrafficDashboardLeafletMap {...rest} />
  );
}
