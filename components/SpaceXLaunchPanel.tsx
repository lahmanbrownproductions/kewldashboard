"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDashboardLocation } from "@/components/dashboard-location-context";
import type { SpaceXLaunchBrief } from "@/lib/spacex-launches";

type ApiPayload = {
  launches: SpaceXLaunchBrief[];
  attribution?: string;
  error?: string;
};

function formatNetInZone(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toUTCString();
  }
}

/** Local T− ticks every second; this only gates how often we hit `/api/spacex-launches`. */
const BACKGROUND_SYNC_MS = 15 * 60 * 1000;
/** Avoid a fetch storm when flipping browser tabs. */
const MIN_MS_VISIBILITY_SYNC = 3 * 60 * 1000;

function launchesSyncFingerprint(launches: SpaceXLaunchBrief[]): string {
  return launches
    .map((l) => `${l.id}:${l.net}:${l.statusAbbrev}:${l.statusName}`)
    .join("|");
}

function countdownLabel(targetMs: number, nowMs: number): string {
  if (nowMs >= targetMs) {
    return "NET passed — verify live status";
  }
  const d = targetMs - nowMs;
  const sec = Math.floor(d / 1000);
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const day = Math.floor(h / 24);
  if (day > 0) {
    return `T− ${day}d ${h % 24}h ${m % 60}m`;
  }
  if (h > 0) {
    return `T− ${h}h ${m % 60}m ${sec % 60}s`;
  }
  if (m > 0) {
    return `T− ${m}m ${sec % 60}s`;
  }
  return `T− ${sec}s`;
}

export function SpaceXLaunchPanel() {
  const { location } = useDashboardLocation();
  const tz = location.timezone;
  const [payload, setPayload] = useState<ApiPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastVisibilitySyncAt = useRef(0);

  const fetchPayload = useCallback(async (): Promise<ApiPayload | null> => {
    const res = await fetch("/api/spacex-launches", { cache: "no-store" });
    const json = (await res.json()) as ApiPayload;
    if (!res.ok) {
      throw new Error(json.error ?? "Schedule relay offline");
    }
    return json;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    (async () => {
      try {
        const json = await fetchPayload();
        if (!cancelled && json) {
          setPayload(json);
          setLoadError(
            json.error && (!json.launches || json.launches.length === 0) ? json.error : null,
          );
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error && err.message ? err.message : "Schedule relay offline";
          setLoadError(msg);
          setPayload(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPayload]);

  /** Occasional manifest refresh; NET/countdown stays local until the payload differs. */
  const resyncSilently = useCallback(async () => {
    if (document.visibilityState !== "visible") {
      return;
    }
    try {
      const json = await fetchPayload();
      if (json) {
        setPayload((prev) => {
          if (!prev) {
            return json;
          }
          if (launchesSyncFingerprint(json.launches) === launchesSyncFingerprint(prev.launches)) {
            return prev;
          }
          return json;
        });
        if (json.launches.length > 0) {
          setLoadError(null);
        }
      }
    } catch {
      /* keep showing last good data */
    }
  }, [fetchPayload]);

  const launches = payload?.launches ?? [];
  const primary = launches[0];

  useEffect(() => {
    const id = window.setInterval(() => {
      void resyncSilently();
    }, BACKGROUND_SYNC_MS);
    return () => window.clearInterval(id);
  }, [resyncSilently]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") {
        return;
      }
      const t = Date.now();
      if (t - lastVisibilitySyncAt.current < MIN_MS_VISIBILITY_SYNC) {
        return;
      }
      lastVisibilitySyncAt.current = t;
      void resyncSilently();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [resyncSilently]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const rest = launches.slice(1);

  const countdown = useMemo(() => {
    if (!primary) {
      return null;
    }
    return countdownLabel(new Date(primary.net).getTime(), now);
  }, [primary, now]);

  return (
    <article
      id="spacex-launches"
      className="panel spacex-launch-panel radar-panel scroll-target"
      aria-label="SpaceX launch schedule"
    >
      <div className="panel-heading">
        <span>SpaceX manifest</span>
        <strong className="map-panel-attribution">
          Upcoming Falcon / Starship attempt schedule —{" "}
          <a href="https://www.spacex.com/launches" target="_blank" rel="noreferrer noopener">
            SpaceX
          </a>
          <br />
          <a href="https://thespacedevs.com" target="_blank" rel="noreferrer noopener">
            Launch Library 2
          </a>
        </strong>
      </div>

      <div className="spacex-launch-body">
        {loadError ? (
          <p className="spacex-launch-status spacex-launch-status--warn" role="status">
            {loadError}
          </p>
        ) : null}

        {!loadError && !primary ? (
          <p className="spacex-launch-status" role="status">
            No upcoming SpaceX entries in range — extend search later.
          </p>
        ) : null}

        {primary ? (
          <div className="spacex-launch-primary">
            <header className="spacex-launch-primary-header">
              <span className="spacex-launch-countdown" aria-live="polite">
                {countdown}
              </span>
            </header>
            <div className="spacex-launch-status-block">
              <div className="spacex-launch-net-label">Launch status</div>
              <p className="spacex-launch-status-heading">
                <span className="spacex-launch-status-name">{primary.statusName}</span>
                {primary.statusAbbrev && primary.statusAbbrev !== primary.statusName ? (
                  <span className="spacex-launch-status-abbrev" title="Abbreviation">
                    {" "}
                    ({primary.statusAbbrev})
                  </span>
                ) : null}
              </p>
              {primary.statusDescription ? (
                <p className="spacex-launch-status-desc">{primary.statusDescription}</p>
              ) : null}
            </div>
            <h3 className="spacex-launch-mission-name">{primary.name}</h3>
            <p className="spacex-launch-net">
              <span className="spacex-launch-net-label">NET</span>{" "}
              {formatNetInZone(primary.net, tz)}
            </p>
            <p className="spacex-launch-pad">
              {primary.padName} · {primary.locationName}
            </p>
            {primary.missionDescription ? (
              <p className="spacex-launch-mission-desc">{primary.missionDescription}</p>
            ) : null}
            {primary.latestUpdate ? (
              <blockquote className="spacex-launch-news">
                <p>{primary.latestUpdate.comment}</p>
                {primary.latestUpdate.infoUrl ? (
                  <a href={primary.latestUpdate.infoUrl} target="_blank" rel="noreferrer noopener">
                    Source
                  </a>
                ) : null}
              </blockquote>
            ) : null}
            <div className="spacex-launch-links">
              {primary.officialUrl ? (
                <a href={primary.officialUrl} target="_blank" rel="noreferrer noopener">
                  Mission page
                </a>
              ) : null}
              {primary.webcastUrl ? (
                <a href={primary.webcastUrl} target="_blank" rel="noreferrer noopener">
                  Webcast
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        {rest.length > 0 ? (
          <ul className="spacex-launch-upcoming-list" aria-label="Further upcoming flights">
            {rest.map((launch) => (
              <li
                key={launch.id}
                aria-label={`${launch.name}, status ${launch.statusName}, ${formatNetInZone(launch.net, tz)}`}
                title={`${launch.statusName} — ${launch.name}`}
              >
                <span className="spacex-launch-upcoming-net">{formatNetInZone(launch.net, tz)}</span>
                <span className="spacex-launch-upcoming-name">{launch.name}</span>
                <span className="spacex-launch-upcoming-status" title={launch.statusName}>
                  {launch.statusAbbrev}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {payload?.attribution ? (
          <footer className="spacex-launch-footnote">{payload.attribution}</footer>
        ) : null}
      </div>
    </article>
  );
}
