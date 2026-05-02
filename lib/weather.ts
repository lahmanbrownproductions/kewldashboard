import { type DashboardLocation, DEFAULT_DASHBOARD_LOCATION } from "@/lib/dashboard-location";

export type WeatherReport = {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  windDirection: number;
  condition: string;
  daily: Array<{
    day: string;
    condition: string;
    high: number;
    low: number;
    rainChance: number;
  }>;
};

const FALLBACK_WEATHER: WeatherReport = {
  temperature: 78,
  apparentTemperature: 80,
  humidity: 72,
  precipitation: 0,
  windSpeed: 8,
  windDirection: 135,
  condition: "Standby",
  daily: [
    { day: "Today", condition: "Awaiting telemetry", high: 82, low: 68, rainChance: 20 },
    { day: "Tomorrow", condition: "Local forecast fallback", high: 81, low: 67, rainChance: 25 },
    { day: "Next", condition: "Sensors nominal", high: 83, low: 69, rainChance: 30 },
  ],
};

const conditionForCode = (code: number) => {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorms";
  return "Mixed conditions";
};

const dayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });

const round = (value: number | undefined, fallback = 0) =>
  Number.isFinite(value) ? Math.round(value as number) : fallback;

export async function getWeatherReport(
  location: DashboardLocation = DEFAULT_DASHBOARD_LOCATION,
): Promise<WeatherReport> {
  try {
    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current:
        "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      precipitation_unit: "inch",
      timezone: location.timezone,
      forecast_days: "4",
    });

    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      next: { revalidate: 900 },
    });

    if (!response.ok) {
      return FALLBACK_WEATHER;
    }

    const data = await response.json();
    const dailyTime: string[] = data.daily?.time ?? [];

    return {
      temperature: round(data.current?.temperature_2m, FALLBACK_WEATHER.temperature),
      apparentTemperature: round(data.current?.apparent_temperature, FALLBACK_WEATHER.apparentTemperature),
      humidity: round(data.current?.relative_humidity_2m, FALLBACK_WEATHER.humidity),
      precipitation: Number(data.current?.precipitation ?? FALLBACK_WEATHER.precipitation),
      windSpeed: round(data.current?.wind_speed_10m, FALLBACK_WEATHER.windSpeed),
      windDirection: round(data.current?.wind_direction_10m, FALLBACK_WEATHER.windDirection),
      condition: conditionForCode(data.current?.weather_code ?? -1),
      daily: dailyTime.slice(0, 4).map((date, index) => ({
        day: index === 0 ? "Today" : dayFormatter.format(new Date(`${date}T12:00:00`)),
        condition: conditionForCode(data.daily?.weather_code?.[index] ?? -1),
        high: round(data.daily?.temperature_2m_max?.[index], FALLBACK_WEATHER.daily[0].high),
        low: round(data.daily?.temperature_2m_min?.[index], FALLBACK_WEATHER.daily[0].low),
        rainChance: round(data.daily?.precipitation_probability_max?.[index], FALLBACK_WEATHER.daily[0].rainChance),
      })),
    };
  } catch {
    return FALLBACK_WEATHER;
  }
}
