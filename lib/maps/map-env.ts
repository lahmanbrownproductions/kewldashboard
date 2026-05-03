/**
 * Optional env (never commit secrets — use Vercel / local .env only):
 *
 * NEXT_PUBLIC_OPENWEATHERMAP_API_KEY — enables Precip / Clouds toggles on the radar map.
 * NEXT_PUBLIC_MAP_TRAFFIC_TILE_URL — optional Leaflet tile URL template with {z},{x},{y} (and
 *   optionally {s}) for a traffic provider you supply (e.g. TomTom / Mapbox raster template).
 */

function readPublic(name: string): string | undefined {
  if (typeof process === "undefined") {
    return undefined;
  }
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export function getOpenWeatherMapApiKey(): string | undefined {
  return readPublic("NEXT_PUBLIC_OPENWEATHERMAP_API_KEY");
}

export function getTrafficTileUrlTemplate(): string | undefined {
  return readPublic("NEXT_PUBLIC_MAP_TRAFFIC_TILE_URL");
}
