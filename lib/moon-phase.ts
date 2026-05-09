const SYNODIC_MS = 29.530588853 * 86_400_000;
/** J2000.0 epoch reference new moon (UTC) — anchors age / cycle. */
const J2000_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14, 0);

const PHASE_NAMES = [
  "New moon",
  "Waxing crescent",
  "First quarter",
  "Waxing gibbous",
  "Full moon",
  "Waning gibbous",
  "Last quarter",
  "Waning crescent",
] as const;

function cyclePhase01(dateMs: number): number {
  const ageMs = ((dateMs - J2000_NEW_MOON_UTC) % SYNODIC_MS + SYNODIC_MS) % SYNODIC_MS;
  return ageMs / SYNODIC_MS;
}

/** Julian date (UT), suitable for readouts / logs. */
export function julianDateUT(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5;
}

export type MoonPhaseInfo = {
  /** 0 = new … 0.5 = full … 1 = next new (synodic / cos illumination). */
  phase01: number;
  /** Approximate age in days along the current synodic month. */
  ageDays: number;
  /** 0–1 fraction of the disc illuminated. */
  illumination01: number;
  phaseName: string;
};

export function getMoonPhaseInfo(date: Date): MoonPhaseInfo {
  const ms = date.getTime();
  const phase01 = cyclePhase01(ms);
  const ageDays = (((ms - J2000_NEW_MOON_UTC) % SYNODIC_MS) + SYNODIC_MS) % SYNODIC_MS / 86_400_000;
  const illumination01 = (1 - Math.cos(2 * Math.PI * phase01)) / 2;
  const band = Math.floor(((phase01 + 1 / 16) % 1) * 8) % 8;
  return {
    phase01,
    ageDays,
    illumination01,
    phaseName: PHASE_NAMES[band],
  };
}

/** Approximate next instant (UTC) when phase crosses `target01` (e.g. 0.5 = full). */
export function approximateNextPhaseUtc(from: Date, target01: number): Date {
  const fromMs = from.getTime();
  const p0 = cyclePhase01(fromMs);
  let delta01 = (target01 - p0 + 1) % 1;
  if (delta01 < 1 / 1440) {
    delta01 = 1;
  }
  return new Date(fromMs + delta01 * SYNODIC_MS);
}

export function seasonalSkyBlurb(utcMonth: number): string {
  if (utcMonth === 11 || utcMonth <= 1) {
    return "Winter / early sky: Orion, Taurus, Gemini bracket the ecliptic; bright Sirius follows.";
  }
  if (utcMonth <= 4) {
    return "Spring evening: Leo and the Sickle rise in the east; Big Dipper pointer finds Polaris.";
  }
  if (utcMonth <= 7) {
    return "Summer Milky Way: Sagittarius and Scorpius toward the galactic center (southern vault).";
  }
  return "Autumn: Andromeda, Pegasus' Great Square; bright Jupiter / Saturn often in the south.";
}
