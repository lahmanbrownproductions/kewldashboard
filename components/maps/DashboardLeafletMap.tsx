"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CircleMarker, MapContainer, Pane, TileLayer, ZoomControl } from "react-leaflet";

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
import {
  MAX_NAVIGATION_ROUTES,
  NAVIGATION_ROUTES_STORAGE_KEY,
  newNavigationRouteId,
  parseNavigationRoutes,
  sanitizeRouteField,
  type NavigationRoute,
} from "@/lib/navigation-routes";

import "./dashboard-leaflet-map.css";

/** Leaflet's built-in map zoom ignores `zoomControlOptions`; use `ZoomControl` with `position` instead. */
const MAP_NO_DEFAULT_ZOOM = { zoomControl: false } as const;

export type DashboardLeafletMapVariant = "radar" | "navigation";

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

function buildGoogleDirectionsUrl(origin: string, destination: string): string | null {
  const dest = destination.trim();
  if (!dest) return null;
  const params = new URLSearchParams({ api: "1", destination: dest, travelmode: "driving" });
  const from = origin.trim();
  if (from) params.set("origin", from);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function NavigationDashboardLeafletMap({ center, zoom, areaLabel }: Omit<DashboardLeafletMapProps, "variant">) {
  const lat = center[0];
  const lng = center[1];
  const stationCenter: [number, number] = [lat, lng];

  const defaultZoom = 11;
  const requestedZoom = zoom ?? defaultZoom;
  const maxUiZoom = 18;
  const viewZoom = clampZoom(requestedZoom, maxUiZoom);

  const [routes, setRoutes] = useState<NavigationRoute[]>(() =>
    parseNavigationRoutes(
      typeof window !== "undefined" ? window.localStorage.getItem(NAVIGATION_ROUTES_STORAGE_KEY) : null,
    ),
  );
  const [draftFrom, setDraftFrom] = useState(areaLabel);
  const [draftTo, setDraftTo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFrom, setEditFrom] = useState("");
  const [editTo, setEditTo] = useState("");

  useEffect(() => {
    setDraftFrom((prev) => (prev.trim() === "" ? areaLabel : prev));
  }, [areaLabel]);

  useEffect(() => {
    window.localStorage.setItem(NAVIGATION_ROUTES_STORAGE_KEY, JSON.stringify(routes));
  }, [routes]);

  const updateRoute = (id: string, from: string, to: string) => {
    const f = sanitizeRouteField(from);
    const t = sanitizeRouteField(to);
    if (!t) {
      return;
    }
    setRoutes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, from: f, to: t } : r)),
    );
    setEditingId(null);
  };

  const removeRoute = (id: string) => {
    setRoutes((prev) => prev.filter((r) => r.id !== id));
    setEditingId((cur) => (cur === id ? null : cur));
  };

  const addRoute = (e?: FormEvent) => {
    e?.preventDefault();
    const f = sanitizeRouteField(draftFrom);
    const t = sanitizeRouteField(draftTo);
    if (!t) {
      return;
    }
    setRoutes((prev) =>
      [...prev, { id: newNavigationRouteId(), from: f, to: t }].slice(0, MAX_NAVIGATION_ROUTES),
    );
    setDraftTo("");
  };

  const beginEdit = (route: NavigationRoute) => {
    setEditingId(route.id);
    setEditFrom(route.from);
    setEditTo(route.to);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFrom("");
    setEditTo("");
  };

  return (
    <div className="leaflet-map-shell" aria-label={`Map near ${areaLabel}`}>
      <div className="map-navigation-shell" aria-label="Saved navigation routes">
        <div className="map-navigation-routes-scroll">
          <ul className="map-navigation-routes" aria-label="From and to routes">
            {routes.length === 0 ? (
              <li className="map-navigation-empty">No saved routes yet. Add one below.</li>
            ) : (
              routes.map((route) => {
                const mapsUrl = buildGoogleDirectionsUrl(route.from, route.to);
                const isEditing = editingId === route.id;

                if (isEditing) {
                  return (
                    <li key={route.id} className="map-navigation-route map-navigation-route--editing">
                      <div className="map-navigation-route-edit-fields">
                        <label className="map-navigation-edit-field">
                          <span className="map-navigation-field-label">From</span>
                          <input
                            type="text"
                            value={editFrom}
                            onChange={(event) => setEditFrom(event.target.value)}
                            placeholder="Starting place (optional)"
                            maxLength={160}
                            autoComplete="address-line1"
                          />
                        </label>
                        <label className="map-navigation-edit-field">
                          <span className="map-navigation-field-label">To</span>
                          <input
                            type="text"
                            value={editTo}
                            onChange={(event) => setEditTo(event.target.value)}
                            placeholder="Destination"
                            maxLength={160}
                            autoComplete="address-line1"
                          />
                        </label>
                      </div>
                      <div className="map-navigation-route-edit-actions">
                        <button type="button" onClick={() => updateRoute(route.id, editFrom, editTo)}>
                          Save
                        </button>
                        <button type="button" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </li>
                  );
                }

                return (
                  <li key={route.id} className="map-navigation-route">
                    <a
                      className={`map-navigation-route-link map-layer-toggle map-layer-toggle--link${mapsUrl ? " is-on" : ""}`}
                      href={mapsUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer noopener"
                      tabIndex={mapsUrl ? undefined : -1}
                      aria-disabled={!mapsUrl}
                      onClick={(event) => {
                        if (!mapsUrl) event.preventDefault();
                      }}
                    >
                      <span className="map-navigation-route-meta">
                        {route.from.trim() ? route.from.trim() : "Your location"}
                        <span aria-hidden="true"> → </span>
                        {route.to.trim()}
                      </span>
                      <span className="map-navigation-route-cta">Google Maps</span>
                    </a>
                    <button
                      type="button"
                      className="map-navigation-icon-btn"
                      aria-label={`Edit route to ${route.to}`}
                      onClick={(event) => {
                        event.preventDefault();
                        beginEdit(route);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="map-navigation-icon-btn map-navigation-icon-btn--danger"
                      aria-label={`Remove route to ${route.to}`}
                      onClick={(event) => {
                        event.preventDefault();
                        removeRoute(route.id);
                      }}
                    >
                      ✕
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
        <form className="map-navigation-add-form" aria-label="Add route" onSubmit={addRoute}>
          <label className="map-navigation-edit-field map-navigation-edit-field--inline">
            <span className="map-navigation-field-label">From</span>
            <input
              type="text"
              value={draftFrom}
              onChange={(event) => setDraftFrom(event.target.value)}
              placeholder="Starting place (optional)"
              maxLength={160}
              autoComplete="address-line1"
            />
          </label>
          <label className="map-navigation-edit-field map-navigation-edit-field--inline">
            <span className="map-navigation-field-label">To</span>
            <input
              type="text"
              value={draftTo}
              onChange={(event) => setDraftTo(event.target.value)}
              placeholder="Destination (required)"
              maxLength={160}
              autoComplete="address-line1"
            />
          </label>
          <button type="submit" className="map-navigation-add-submit">
            Add route
          </button>
        </form>
      </div>

      <MapContainer
        center={stationCenter}
        zoom={viewZoom}
        maxZoom={18}
        minZoom={2}
        className="dashboard-leaflet-map"
        scrollWheelZoom
        {...MAP_NO_DEFAULT_ZOOM}
      >
        <ZoomControl position="bottomright" />
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
  const [showRadar, setShowRadar] = useState(true);
  const [showCoverage, setShowCoverage] = useState(false);
  const [showPrecip, setShowPrecip] = useState(false);
  const [showClouds, setShowClouds] = useState(false);

  const refreshRainViewer = useCallback(async () => {
    const maps = await fetchRainViewerMaps();
    if (maps) {
      setRainMaps(maps);
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

      <MapContainer
        center={stationCenter}
        zoom={viewZoom}
        maxZoom={RADAR_NATIVE_MAX_ZOOM}
        minZoom={2}
        className="dashboard-leaflet-map"
        scrollWheelZoom
        {...MAP_NO_DEFAULT_ZOOM}
      >
        <ZoomControl position="bottomright" />
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
    <NavigationDashboardLeafletMap {...rest} />
  );
}
