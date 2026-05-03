"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Pane, TileLayer, ZoomControl } from "react-leaflet";

import { MapResizeFix } from "@/components/maps/MapResizeFix";
import { MapViewUpdater } from "@/components/maps/MapViewUpdater";
import {
  CARTO_DARK_ATTRIBUTION,
  CARTO_DARK_TILE_URL,
  OPENWEATHER_MAP_ATTRIBUTION,
  RAINVIEWER_ATTRIBUTION,
} from "@/lib/maps/basemap";
import { getOpenWeatherMapApiKey, getTrafficTileUrlTemplate } from "@/lib/maps/map-env";
import { openWeatherCloudsTileUrl, openWeatherPrecipitationTileUrl } from "@/lib/maps/open-weather-tiles";
import {
  coverageTileUrlTemplate,
  fetchRainViewerMaps,
  getLatestRadarFrame,
  radarTileUrlTemplate,
  type RainViewerMaps,
} from "@/lib/maps/rainviewer";

import "./dashboard-leaflet-map.css";

const RADAR_NATIVE_MAX_ZOOM = 7;

export type DashboardLeafletMapVariant = "radar" | "traffic";

export type DashboardLeafletMapProps = {
  center: [number, number];
  zoom?: number;
  variant: DashboardLeafletMapVariant;
  areaLabel: string;
};

export function DashboardLeafletMap({ center, zoom, variant, areaLabel }: DashboardLeafletMapProps) {
  const defaultZoom = variant === "radar" ? 6 : 11;
  const requestedZoom = zoom ?? defaultZoom;
  const viewZoom =
    variant === "radar" ? Math.min(requestedZoom, RADAR_NATIVE_MAX_ZOOM) : requestedZoom;

  const owmKey = useMemo(() => getOpenWeatherMapApiKey(), []);
  const trafficTemplate = useMemo(() => getTrafficTileUrlTemplate(), []);

  const [mapsMeta, setMapsMeta] = useState<RainViewerMaps | null>(null);
  const [radarFetchError, setRadarFetchError] = useState<string | null>(null);

  const loadRainViewer = useCallback(async () => {
    setRadarFetchError(null);
    const data = await fetchRainViewerMaps();
    if (!data?.host) {
      setRadarFetchError("Radar metadata unavailable (check network).");
      setMapsMeta(null);
      return;
    }
    setMapsMeta(data);
  }, []);

  useEffect(() => {
    void loadRainViewer();
    const id = window.setInterval(() => void loadRainViewer(), 300_000);
    return () => window.clearInterval(id);
  }, [loadRainViewer]);

  const radarFrame = useMemo(() => (mapsMeta ? getLatestRadarFrame(mapsMeta) : null), [mapsMeta]);
  const radarUrlTemplate = useMemo(() => {
    if (!mapsMeta?.host || !radarFrame?.path) {
      return null;
    }
    return radarTileUrlTemplate(mapsMeta.host, radarFrame.path, 512);
  }, [mapsMeta, radarFrame]);

  const coverageUrlTemplate = useMemo(
    () => (mapsMeta?.host ? coverageTileUrlTemplate(mapsMeta.host, 512) : null),
    [mapsMeta],
  );

  const [showRadar, setShowRadar] = useState(true);
  const [showCoverage, setShowCoverage] = useState(false);
  const [showPrecip, setShowPrecip] = useState(false);
  const [showClouds, setShowClouds] = useState(false);
  const [showTrafficTiles, setShowTrafficTiles] = useState(false);

  useEffect(() => {
    if (variant === "radar") {
      setShowRadar(true);
      setShowTrafficTiles(false);
    } else {
      setShowRadar(false);
      setShowCoverage(false);
      setShowPrecip(false);
      setShowClouds(false);
      setShowTrafficTiles(Boolean(trafficTemplate));
    }
  }, [variant, trafficTemplate]);

  const precipUrl = owmKey ? openWeatherPrecipitationTileUrl(owmKey) : null;
  const cloudsUrl = owmKey ? openWeatherCloudsTileUrl(owmKey) : null;

  const centerExpr: [number, number] = [center[0], center[1]];
  const wazeUrl = `https://waze.com/ul?ll=${center[0]},${center[1]}&zoom=11&navigate=yes`;

  return (
    <div className="leaflet-map-shell" aria-label={`Map near ${areaLabel}`}>
      {variant === "radar" && radarFetchError ? (
        <div className="map-leaflet-banner" role="status">
          {radarFetchError}
        </div>
      ) : null}

      <div className="map-overlay-toolbar" role="toolbar" aria-label="Map overlays">
        {variant === "radar" ? (
          <>
            <button
              type="button"
              className={`map-layer-toggle ${showRadar && radarUrlTemplate ? "is-on" : ""}`}
              disabled={!radarUrlTemplate}
              onClick={() => setShowRadar((v) => !v)}
            >
              Radar
            </button>
            <button
              type="button"
              className={`map-layer-toggle ${showCoverage ? "is-on" : ""}`}
              disabled={!coverageUrlTemplate}
              onClick={() => setShowCoverage((v) => !v)}
            >
              Coverage
            </button>
            <button
              type="button"
              className={`map-layer-toggle ${showPrecip ? "is-on" : ""}`}
              disabled={!precipUrl}
              title={!precipUrl ? "Set NEXT_PUBLIC_OPENWEATHERMAP_API_KEY for precip tiles" : undefined}
              onClick={() => setShowPrecip((v) => !v)}
            >
              Precip
            </button>
            <button
              type="button"
              className={`map-layer-toggle ${showClouds ? "is-on" : ""}`}
              disabled={!cloudsUrl}
              title={!cloudsUrl ? "Set NEXT_PUBLIC_OPENWEATHERMAP_API_KEY for cloud tiles" : undefined}
              onClick={() => setShowClouds((v) => !v)}
            >
              Clouds
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`map-layer-toggle ${showTrafficTiles ? "is-on" : ""}`}
              disabled={!trafficTemplate}
              title={
                !trafficTemplate
                  ? "Optional: NEXT_PUBLIC_MAP_TRAFFIC_TILE_URL ({z},{x},{y})"
                  : undefined
              }
              onClick={() => setShowTrafficTiles((v) => !v)}
            >
              Traffic
            </button>
            <a
              className="map-layer-toggle map-layer-toggle--link is-on"
              href={wazeUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              Waze
            </a>
          </>
        )}
      </div>

      <MapContainer
        center={centerExpr}
        zoom={viewZoom}
        maxZoom={18}
        minZoom={2}
        className="dashboard-leaflet-map"
        scrollWheelZoom
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <MapResizeFix />
        <MapViewUpdater center={centerExpr} zoom={viewZoom} />

        <TileLayer
          url={CARTO_DARK_TILE_URL}
          attribution={CARTO_DARK_ATTRIBUTION}
          maxZoom={20}
          subdomains="abcd"
        />

        {showCoverage && coverageUrlTemplate ? (
          <TileLayer
            url={coverageUrlTemplate}
            attribution={RAINVIEWER_ATTRIBUTION}
            opacity={0.42}
            maxZoom={18}
            maxNativeZoom={RADAR_NATIVE_MAX_ZOOM}
            zIndex={300}
          />
        ) : null}

        {showRadar && radarUrlTemplate ? (
          <TileLayer
            key={radarFrame?.path ?? "radar"}
            url={radarUrlTemplate}
            attribution={RAINVIEWER_ATTRIBUTION}
            opacity={0.76}
            maxZoom={18}
            maxNativeZoom={RADAR_NATIVE_MAX_ZOOM}
            zIndex={400}
          />
        ) : null}

        {showPrecip && precipUrl ? (
          <TileLayer
            url={precipUrl}
            attribution={OPENWEATHER_MAP_ATTRIBUTION}
            opacity={0.52}
            maxZoom={18}
            zIndex={450}
          />
        ) : null}

        {showClouds && cloudsUrl ? (
          <TileLayer
            url={cloudsUrl}
            attribution={OPENWEATHER_MAP_ATTRIBUTION}
            opacity={0.38}
            maxZoom={18}
            zIndex={460}
          />
        ) : null}

        {variant === "traffic" && showTrafficTiles && trafficTemplate ? (
          <TileLayer
            url={trafficTemplate}
            attribution="Traffic tiles (see NEXT_PUBLIC_MAP_TRAFFIC_TILE_URL)"
            opacity={0.68}
            maxZoom={18}
            zIndex={500}
          />
        ) : null}

        <Pane name="station-marker" style={{ zIndex: 650 }}>
          <CircleMarker
            center={centerExpr}
            radius={9}
            pathOptions={{
              color: "#f5c96b",
              weight: 2,
              fillColor: "#c97e5f",
              fillOpacity: 0.55,
            }}
          />
        </Pane>
      </MapContainer>
    </div>
  );
}
