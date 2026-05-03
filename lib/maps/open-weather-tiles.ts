/** Precipitation overlay tiles (requires OpenWeather "One Call" / Tiles product key). */
export function openWeatherPrecipitationTileUrl(apiKey: string): string {
  return `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${encodeURIComponent(apiKey)}`;
}

/** Global cloud cover (approximate). */
export function openWeatherCloudsTileUrl(apiKey: string): string {
  return `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${encodeURIComponent(apiKey)}`;
}
