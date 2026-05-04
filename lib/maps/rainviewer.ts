/**
 * RainViewer Weather Maps API — personal/educational use; attribution required.
 * https://www.rainviewer.com/api/weather-maps-api.html
 */

export type RainViewerFrame = {
  time: number;
  path: string;
};

export type RainViewerMaps = {
  version: string;
  generated: number;
  host: string;
  radar: { past: RainViewerFrame[]; nowcast: RainViewerFrame[] };
};

const MAPS_URL = "https://api.rainviewer.com/public/weather-maps.json";

export async function fetchRainViewerMaps(): Promise<RainViewerMaps | null> {
  try {
    const response = await fetch(MAPS_URL);
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as RainViewerMaps;
    if (!data.host || !Array.isArray(data.radar?.past) || data.radar.past.length === 0) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** Latest composite frame from the `past` sequence (API lists frames in time order). */
export function getLatestRadarFrame(maps: RainViewerMaps): RainViewerFrame | null {
  const past = maps.radar?.past;
  if (!past?.length) {
    return null;
  }
  return past[past.length - 1] ?? null;
}

/** Reflectivity tiles: `{host}{path}/{size}/{z}/{x}/{y}/{color}/{smooth}_{snow}.png` */
export function radarTileUrlTemplate(host: string, path: string, size: 256 | 512): string {
  return `${host}${path}/${size}/{z}/{x}/{y}/2/1_1.png`;
}

/** Coverage mask — transparent where radar exists. */
export function coverageTileUrlTemplate(host: string, size: 256 | 512): string {
  return `${host}/v2/coverage/0/${size}/{z}/{x}/{y}/0/0_0.png`;
}
