/**
 * Optional env (never commit secrets — use Vercel / Railway / local .env only):
 *
 * NEXT_PUBLIC_OPENWEATHERMAP_API_KEY — enables Precip and Clouds overlay toggles on the Weather Radar chart.
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
