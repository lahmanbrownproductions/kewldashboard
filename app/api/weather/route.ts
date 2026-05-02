import { NextResponse } from "next/server";

import {
  type DashboardLocation,
  DEFAULT_DASHBOARD_LOCATION,
} from "@/lib/dashboard-location";
import { getWeatherReport } from "@/lib/weather";

function parseLatitude(value: string | null): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < -90 || n > 90) {
    return null;
  }
  return n;
}

function parseLongitude(value: string | null): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < -180 || n > 180) {
    return null;
  }
  return n;
}

function parseTimezone(value: string | null): string | null {
  const tz = (value ?? "").trim();
  if (!tz || tz.length > 80) {
    return null;
  }
  if (!/^[\w/+-]+$/.test(tz)) {
    return null;
  }
  return tz;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = parseLatitude(searchParams.get("latitude"));
  const longitude = parseLongitude(searchParams.get("longitude"));
  const timezone = parseTimezone(searchParams.get("timezone")) ?? DEFAULT_DASHBOARD_LOCATION.timezone;

  if (latitude === null || longitude === null) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const location: DashboardLocation = {
    label: "",
    latitude,
    longitude,
    timezone,
  };

  try {
    const report = await getWeatherReport(location);
    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: "Weather unavailable" }, { status: 502 });
  }
}
