export type RainViewerFrame = {
  time: number;
  path: string;
};

export type RainViewerMaps = {
  version: string;
  generated: number;
  host: string;
  radar: { past: RainViewerFrame[]; nowcast: RainViewerFrame[] };
  satellite?: { infrared: RainViewerFrame[] };
};

const MAPS_URL = "https://api.rainviewer.com/public/weather-maps.json";

export async function fetchRainViewerMaps(): Promise<RainViewerMaps | null> {
  try {
    const response = await fetch(MAPS_URL);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as RainViewerMaps;
  } catch {
    return null;
  }
}

export function getLatestRadarFrame(maps: RainViewerMaps): RainViewerFrame | null {
  const past = maps.radar?.past;
  if (!past?.length) {
    return null;
  }
  return past[past.length - 1] ?? null;
}

/**
 * Leaflet tile template. See RainViewer Weather Maps API: `{path}/{size}/{z}/{x}/{y}/{color}/{options}.png`
 * Max zoom 7 for radar imagery.
 */
export function radarTileUrlTemplate(host: string, path: string, size: 256 | 512 = 512): string {
  const color = 2;
  const options = "1_1";
  return `${host}${path}/${size}/{z}/{x}/{y}/${color}/${options}.png`;
}

export function coverageTileUrlTemplate(host: string, size: 256 | 512 = 512): string {
  return `${host}/v2/coverage/0/${size}/{z}/{x}/{y}/0/0_0.png`;
}
