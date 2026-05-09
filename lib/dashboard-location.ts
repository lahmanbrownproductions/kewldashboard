export type DashboardLocation = {
  label: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export const DASHBOARD_LOCATION_STORAGE_KEY = "kewldashboard.location.v1";

export const DEFAULT_DASHBOARD_LOCATION: DashboardLocation = {
  label: "Slidell, LA",
  latitude: 30.2752,
  longitude: -89.7812,
  timezone: "America/Chicago",
};

const TIMEZONE_PATTERN = /^[\w/+-]+$/;

export const IANA_TIMEZONE_PATTERN = TIMEZONE_PATTERN;

/** Presets shown in station-time timezone modal and used when geocode returns no zone (hero keeps existing). */
export const DASHBOARD_TIMEZONE_PRESETS = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "UTC", label: "UTC" },
] as const;

export function parseDashboardLocation(raw: string | null): DashboardLocation | null {
  if (!raw) {
    return null;
  }

  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const label = typeof value.label === "string" ? value.label.trim().slice(0, 96) : "";
    const lat = typeof value.latitude === "number" ? value.latitude : Number(value.latitude);
    const lon = typeof value.longitude === "number" ? value.longitude : Number(value.longitude);
    const timezone =
      typeof value.timezone === "string" ? value.timezone.trim() : DEFAULT_DASHBOARD_LOCATION.timezone;

    if (!label || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return null;
    }

    if (!TIMEZONE_PATTERN.test(timezone)) {
      return null;
    }

    return { label, latitude: lat, longitude: lon, timezone };
  } catch {
    return null;
  }
}

export function formatHeroIntroCopy(placeLabel: string, hasChosenPlace: boolean): string {
  if (!hasChosenPlace) {
    return "Local weather, maps, markets, and headlines in one LCARS-style board — set your station below.";
  }
  return `${placeLabel}: weather, navigation, markets, and alerts scoped to your coordinates.`;
}

/** Short zone label for UI (e.g. `America/Chicago` → `CT`). Uses `shortGeneric` when supported. */
export function formatDashboardTimezoneAbbrev(timezone: string, referenceDate: Date = new Date()) {
  if (!TIMEZONE_PATTERN.test(timezone)) {
    return "UTC";
  }

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortGeneric",
    }).formatToParts(referenceDate);
    const generic = parts.find((p) => p.type === "timeZoneName")?.value;
    if (generic) {
      return generic;
    }
  } catch {
    /* invalid time zone value */
  }

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(referenceDate);
    const short = parts.find((p) => p.type === "timeZoneName")?.value;
    if (short) {
      return short;
    }
  } catch {
    /* */
  }

  return timezone.includes("/") ? timezone.split("/").pop()!.replace(/_/g, " ") : timezone;
}
