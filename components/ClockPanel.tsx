"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useDashboardLocation } from "@/components/dashboard-location-context";
import {
  DASHBOARD_TIMEZONE_PRESETS,
  formatDashboardTimezoneAbbrev,
  IANA_TIMEZONE_PATTERN,
} from "@/lib/dashboard-location";
import { playSubmitBeep } from "@/lib/button-beep";

export function ClockPanel() {
  const { location, setLocation } = useDashboardLocation();
  const [now, setNow] = useState<Date | null>(null);
  const [tzModalOpen, setTzModalOpen] = useState(false);
  const [modalHost, setModalHost] = useState<HTMLElement | null>(null);

  const tz = location.timezone;

  useEffect(() => {
    setModalHost(document.body);
  }, []);

  useEffect(() => {
    if (!tzModalOpen) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTzModalOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [tzModalOpen]);

  const timezoneModalOptions = useMemo(() => {
    const presets = [...DASHBOARD_TIMEZONE_PRESETS];
    const hasCurrent = presets.some((p) => p.value === tz);
    if (
      !hasCurrent &&
      typeof tz === "string" &&
      tz.trim().length > 0 &&
      IANA_TIMEZONE_PATTERN.test(tz.trim())
    ) {
      return [{ value: tz, label: tz } satisfies { value: string; label: string }, ...presets];
    }
    return presets;
  }, [tz]);

  const { timeFormatter, dateFormatter, tzAbbrev } = useMemo(() => {
    const reference = now ?? new Date();
    const timeFormatter = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: tz,
    });
    const dateFormatter = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: tz,
    });
    return {
      timeFormatter,
      dateFormatter,
      tzAbbrev: formatDashboardTimezoneAbbrev(tz, reference),
    };
  }, [tz, now]);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);

    return () => window.clearInterval(timer);
  }, []);

  function selectTimezone(nextTz: string) {
    playSubmitBeep();
    setLocation({
      ...location,
      timezone: nextTz,
    });
    setTzModalOpen(false);
  }

  return (
    <>
      <section
        id="clock"
        className="panel clock-panel scroll-target"
        aria-label={`Station time in ${tzAbbrev}`}
      >
        <div>
          <p className="eyebrow clock-station-eyebrow">
            <span aria-hidden="true">Station time: </span>
            <button
              type="button"
              className="clock-timezone-hit"
              onClick={() => setTzModalOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={tzModalOpen}
              aria-controls="timezone-dialog"
              id="clock-open-timezone"
            >
              {tzAbbrev}
            </button>
            <span className="sr-only">. Activate to change timezone.</span>
          </p>
          <p className="clock-readout">{now ? timeFormatter.format(now) : "Syncing"}</p>
        </div>
        <p className="panel-note">{now ? dateFormatter.format(now) : "Awaiting chronometer lock"}</p>
      </section>

      {modalHost && tzModalOpen
        ? createPortal(
            <div className="timezone-modal-backdrop" onClick={() => setTzModalOpen(false)} role="presentation">
              <div
                className="timezone-modal-panel"
                id="timezone-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="timezone-dialog-title"
                aria-describedby="timezone-dialog-help"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="timezone-modal-header">
                  <h2 id="timezone-dialog-title">Station timezone</h2>
                  <button type="button" className="timezone-modal-close" onClick={() => setTzModalOpen(false)}>
                    Close
                  </button>
                </header>
                <p id="timezone-dialog-help" className="timezone-modal-help">
                  IANA identifiers; clock and dashboards use your selection unless geocode replaces it on Save.
                </p>
                <ul className="timezone-modal-list">
                  {timezoneModalOptions.map((opt) => (
                    <li key={opt.value}>
                      <button
                        type="button"
                        className={`timezone-modal-option ${opt.value === tz ? "is-active" : ""}`}
                        onClick={() => selectTimezone(opt.value)}
                      >
                        <span>{opt.label}</span>
                        <small>{opt.value}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>,
            modalHost,
          )
        : null}
    </>
  );
}
