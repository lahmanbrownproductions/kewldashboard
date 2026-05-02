"use client";

import { useEffect, useMemo, useState } from "react";

import { useDashboardLocation } from "@/components/dashboard-location-context";
import { formatDashboardTimezoneAbbrev } from "@/lib/dashboard-location";

export function ClockPanel() {
  const { location } = useDashboardLocation();
  const [now, setNow] = useState<Date | null>(null);

  const tz = location.timezone;

  const { timeFormatter, dateFormatter, tzAbbrev } = useMemo(() => {
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
      tzAbbrev: formatDashboardTimezoneAbbrev(tz, new Date()),
    };
  }, [tz]);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);

    return () => window.clearInterval(timer);
  }, []);

  const eyebrow = `Station time: ${tzAbbrev}`;

  return (
    <section
      id="clock"
      className="panel clock-panel scroll-target"
      aria-label={`Station time in ${tzAbbrev}`}
    >
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <p className="clock-readout">{now ? timeFormatter.format(now) : "Syncing"}</p>
      </div>
      <p className="panel-note">{now ? dateFormatter.format(now) : "Awaiting chronometer lock"}</p>
    </section>
  );
}
