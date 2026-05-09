"use client";

import { useEffect, useMemo, useState } from "react";

import { useDashboardLocation } from "@/components/dashboard-location-context";
import {
  approximateNextPhaseUtc,
  getMoonPhaseInfo,
  julianDateUT,
  seasonalSkyBlurb,
} from "@/lib/moon-phase";

function formatWhen(iso: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(iso);
  } catch {
    return iso.toISOString();
  }
}

/** Fixed instant for SSR + first client paint so moon/JD readouts match until mount. */
const SSR_TIME_ANCHOR_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

/** Two-circle overlap moon (phase 0 = new … 0.5 = full). */
function MoonPhaseGlyph({ phase01, label }: { phase01: number; label: string }) {
  const r = 26;
  const cx = 32;
  const cy = 32;
  const dir = phase01 < 0.5 ? 1 : -1;
  const offsetRaw = 2 * r * Math.sin(phase01 * Math.PI) * dir;
  const offset = Math.round(offsetRaw * 1000) / 1000;
  const shadeCx = Math.round((cx - offset) * 1000) / 1000;

  return (
    <svg
      className="science-sky-moon-glyph"
      viewBox="0 0 64 64"
      role="img"
      aria-label={label}
    >
      <circle cx={cx} cy={cy} r={r} className="science-sky-moon-glyph__lit" />
      <circle cx={shadeCx} cy={cy} r={r} className="science-sky-moon-glyph__shade" />
    </svg>
  );
}

export function ScienceSkyPanel() {
  const { location } = useDashboardLocation();
  const tz = location.timezone;
  const [liveNow, setLiveNow] = useState<Date | null>(null);

  useEffect(() => {
    setLiveNow(new Date());
    const id = window.setInterval(() => setLiveNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const anchorMs = liveNow?.getTime() ?? SSR_TIME_ANCHOR_MS;
  const moon = useMemo(() => getMoonPhaseInfo(new Date(anchorMs)), [anchorMs]);
  const jd = useMemo(() => julianDateUT(new Date(anchorMs)), [anchorMs]);
  const nextFull = useMemo(() => approximateNextPhaseUtc(new Date(anchorMs), 0.5), [anchorMs]);
  const nextNew = useMemo(() => approximateNextPhaseUtc(new Date(anchorMs), 0), [anchorMs]);
  const seasonNote = useMemo(
    () => seasonalSkyBlurb(new Date(anchorMs).getUTCMonth()),
    [anchorMs],
  );

  return (
    <article
      id="science-sky"
      className="panel science-sky-panel radar-panel scroll-target"
      aria-label="Local sky and moon phase"
    >
      <div className="panel-heading">
        <span>Observatory window</span>
        <strong className="map-panel-attribution">
          Ephemeris track for {location.label} — synodic model, local clock
        </strong>
      </div>

      <div className="science-sky-body">
        <div className="science-sky-moon-block">
          <MoonPhaseGlyph phase01={moon.phase01} label={`Moon phase: ${moon.phaseName}`} />
          <div className="science-sky-moon-readout">
            <p className="science-sky-phase-name">{moon.phaseName}</p>
            <p className="science-sky-telemetry">
              <span>Illumination</span>{" "}
              <strong>{(moon.illumination01 * 100).toFixed(1)}%</strong>
            </p>
            <p className="science-sky-telemetry">
              <span>Synodic age</span> <strong>{moon.ageDays.toFixed(2)} d</strong>
            </p>
            <p className="science-sky-telemetry science-sky-telemetry--jd">
              <span>Julian date (UT)</span> <strong>{jd.toFixed(4)}</strong>
            </p>
          </div>
        </div>

        <div className="science-sky-schedule">
          <p className="science-sky-section-title">Next disk crossings (approx.)</p>
          <ul className="science-sky-events">
            <li>
              <span>Full</span>
              <strong>{formatWhen(nextFull, tz)}</strong>
            </li>
            <li>
              <span>New</span>
              <strong>{formatWhen(nextNew, tz)}</strong>
            </li>
          </ul>
          <p className="science-sky-season">{seasonNote}</p>
        </div>

        <div className="science-sky-charts">
          <p className="science-sky-section-title">Sky atlases &amp; charts</p>
          <ul className="science-sky-links">
            <li>
              <a href="https://stellarium-web.org/" target="_blank" rel="noreferrer noopener">
                Stellarium Web
              </a>
              <span className="science-sky-link-hint">interactive planetarium</span>
            </li>
            <li>
              <a href="https://theskylive.com/" target="_blank" rel="noreferrer noopener">
                The Sky Live
              </a>
              <span className="science-sky-link-hint">planets &amp; comets ephemeris</span>
            </li>
            <li>
              <a
                href="https://www.timeanddate.com/moon/phases/"
                target="_blank"
                rel="noreferrer noopener"
              >
                Moon calendar
              </a>
              <span className="science-sky-link-hint">times &amp; illumination tables</span>
            </li>
            <li>
              <a
                href={`https://www.heavens-above.com/PassSummary.aspx?lat=${encodeURIComponent(String(location.latitude))}&lng=${encodeURIComponent(String(location.longitude))}&loc=Custom&alt=0`}
                target="_blank"
                rel="noreferrer noopener"
              >
                Heavens Above
              </a>
              <span className="science-sky-link-hint">ISS passes &amp; satellites</span>
            </li>
          </ul>
        </div>
      </div>
    </article>
  );
}
