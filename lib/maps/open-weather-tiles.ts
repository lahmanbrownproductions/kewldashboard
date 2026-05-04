/** Map tile endpoints (requires NEXT_PUBLIC_OPENWEATHERMAP_API_KEY). */

export function openWeatherPrecipitationTileUrl(apiKey: string): string {
  return `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${encodeURIComponent(apiKey)}`;
}

export function openWeatherCloudsTileUrl(apiKey: string): string {
  return `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${encodeURIComponent(apiKey)}`;
}
