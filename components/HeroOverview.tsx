"use client";

import { FormEvent, useEffect, useState } from "react";

import { formatLocationTagline } from "@/lib/dashboard-location";
import { playErrorBeep } from "@/lib/button-beep";
import { scrollToDashboardTarget, type ControlPill } from "@/lib/dashboard-pills";
import { useDashboardLocation } from "@/components/dashboard-location-context";

type HeroOverviewProps = {
  controlPills: ControlPill[];
};

const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "UTC", label: "UTC" },
] as const;

const IANA_TIMEZONE = /^[\w/+-]+$/;

type GeocodeResponse = {
  error?: string;
  label?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string | null;
};

export function HeroOverview({ controlPills }: HeroOverviewProps) {
  const { location, setLocation } = useDashboardLocation();
  const [label, setLabel] = useState(location.label);
  const [timezone, setTimezone] = useState(location.timezone);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLabel(location.label);
    setTimezone(location.timezone);
  }, [location]);

  async function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedLabel = label.trim().slice(0, 96);
    if (!trimmedLabel) {
      return;
    }

    setGeocodeError(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(trimmedLabel)}`);
      const data = (await response.json()) as GeocodeResponse;

      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Could not look up that place.");
      }

      if (typeof data.latitude !== "number" || typeof data.longitude !== "number") {
        throw new Error("Invalid location response.");
      }

      const nextLabel = typeof data.label === "string" ? data.label : trimmedLabel;
      const resolvedTimezone =
        typeof data.timezone === "string" && IANA_TIMEZONE.test(data.timezone.trim())
          ? data.timezone.trim()
          : timezone;

      setLocation({
        label: nextLabel,
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: resolvedTimezone,
      });
      setLabel(nextLabel);
      setTimezone(resolvedTimezone);
    } catch (caught) {
      playErrorBeep();
      setGeocodeError(caught instanceof Error ? caught.message : "Could not save location.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="hero-intro">
        <p className="eyebrow">LCARS 47</p>
        <h1>Kewl Dashboard</h1>
        <p className="hero-copy">{formatLocationTagline(location.label)}</p>
        <div className="control-pills" aria-label="Auxiliary controls">
          {controlPills.map((pill, index) => (
            <a
              key={`${pill.targetId}-${pill.label}-${index}`}
              className={`control-pill control-pill--${pill.accent}`}
              href={`#${pill.targetId}`}
              onClick={(event) => {
                event.preventDefault();
                scrollToDashboardTarget(pill.targetId);
              }}
            >
              {pill.label}
            </a>
          ))}
        </div>
      </div>
      <div id="local-config" className="status-bank scroll-target" aria-label="Dashboard status">
        <form className="hero-location-form" onSubmit={saveLocation} aria-label="Dashboard location">
          <div className="hero-location-fields">
            <label className="hero-location-field">
              <span className="sr-only">Place name</span>
              <input
                value={label}
                onChange={(event) => {
                  setLabel(event.target.value);
                  setGeocodeError(null);
                }}
                placeholder="City, region"
                maxLength={96}
                autoComplete="address-level2"
                disabled={isSaving}
              />
            </label>
            <label className="hero-location-field hero-location-tz">
              <span className="sr-only">Timezone</span>
              <select
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                disabled={isSaving}
              >
                {!TIMEZONE_OPTIONS.some((option) => option.value === timezone) ? (
                  <option value={timezone}>{timezone}</option>
                ) : null}
                {TIMEZONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" className="hero-location-save" disabled={isSaving}>
            {isSaving ? "Looking up…" : "Save location"}
          </button>
          {geocodeError ? <p className="hero-location-geocode-error">{geocodeError}</p> : null}
        </form>
        <div className="status-bank-stats">
          <div>
            <span>Location</span>
            <strong>{location.label}</strong>
          </div>
          <div>
            <span>Sources</span>
            <strong>Weather / Traffic / Markets</strong>
          </div>
        </div>
      </div>
    </>
  );
}
