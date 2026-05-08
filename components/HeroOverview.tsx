"use client";

import { FormEvent, useEffect, useState } from "react";

import { DashboardThemeToggle } from "@/components/DashboardThemeToggle";
import { useDashboardLocation } from "@/components/dashboard-location-context";
import { playErrorBeep } from "@/lib/button-beep";
import {
  formatLocationTagline,
  IANA_TIMEZONE_PATTERN,
  type DashboardLocation,
} from "@/lib/dashboard-location";
import { scrollToDashboardTarget, type ControlPill } from "@/lib/dashboard-pills";

type HeroOverviewProps = {
  controlPills: ControlPill[];
};

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
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLabel(location.label);
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
        typeof data.timezone === "string" && IANA_TIMEZONE_PATTERN.test(data.timezone.trim())
          ? data.timezone.trim()
          : location.timezone;

      const next: DashboardLocation = {
        label: nextLabel,
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: resolvedTimezone,
      };

      setLocation(next);
      setLabel(nextLabel);
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
        <p className="eyebrow">lahmanbrownproductions</p>
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
          <DashboardThemeToggle />
        </div>
      </div>
      <div id="local-config" className="status-bank scroll-target" aria-label="Dashboard status">
        <form className="hero-location-form" onSubmit={saveLocation} aria-label="Dashboard location">
          <div className="hero-location-row">
            <label className="hero-location-field hero-location-place">
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
            <button type="submit" className="hero-location-save" disabled={isSaving}>
              {isSaving ? "Looking up…" : "Save location"}
            </button>
          </div>
          {geocodeError ? <p className="hero-location-geocode-error">{geocodeError}</p> : null}
        </form>
        <div className="status-bank-stats">
          <div>
            <span>Location</span>
            <strong>{location.label}</strong>
          </div>
          <div>
            <span>Sources</span>
            <strong>Weather / Navigation / Markets</strong>
          </div>
        </div>
      </div>
    </>
  );
}
