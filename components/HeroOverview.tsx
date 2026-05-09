"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { DashboardThemeToggle } from "@/components/DashboardThemeToggle";
import { EditableDashboardTitle } from "@/components/EditableDashboardTitle";
import { useDashboardLocation } from "@/components/dashboard-location-context";
import { playErrorBeep } from "@/lib/button-beep";
import {
  formatHeroIntroCopy,
  IANA_TIMEZONE_PATTERN,
  type DashboardLocation,
} from "@/lib/dashboard-location";
import {
  controlPillsForSectionOrder,
  scrollToDashboardTarget,
} from "@/lib/dashboard-pills";
import {
  DASHBOARD_SECTION_ORDER_STORAGE_KEY,
  DEFAULT_DASHBOARD_SECTION_ORDER,
  restoreDashboardSectionOrder,
  type DashboardSectionId,
} from "@/lib/dashboard-sections";

type GeocodeResponse = {
  error?: string;
  label?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string | null;
};

export function HeroOverview() {
  const { location, setLocation, hasStoredLocation, locationHydrated } = useDashboardLocation();
  const [label, setLabel] = useState("");
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<DashboardSectionId[]>(() => [
    ...DEFAULT_DASHBOARD_SECTION_ORDER,
  ]);

  useEffect(() => {
    const oldRailOrder = window.localStorage.getItem("kewldashboard.railOrder.v1");
    const savedOrder = window.localStorage.getItem(DASHBOARD_SECTION_ORDER_STORAGE_KEY) ?? oldRailOrder;
    setSectionOrder(restoreDashboardSectionOrder(savedOrder));
  }, []);

  useEffect(() => {
    function onRailOrderChange() {
      const saved = window.localStorage.getItem(DASHBOARD_SECTION_ORDER_STORAGE_KEY);
      setSectionOrder(restoreDashboardSectionOrder(saved));
    }
    window.addEventListener("kewldashboard:rail-order-change", onRailOrderChange);
    return () => window.removeEventListener("kewldashboard:rail-order-change", onRailOrderChange);
  }, []);

  const controlPills = useMemo(() => controlPillsForSectionOrder(sectionOrder), [sectionOrder]);

  useEffect(() => {
    if (!locationHydrated) {
      return;
    }
    if (hasStoredLocation) {
      setLabel(location.label);
    } else {
      setLabel("");
    }
  }, [locationHydrated, hasStoredLocation, location.label]);

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
        <EditableDashboardTitle />
        <p className="hero-copy">
          {formatHeroIntroCopy(location.label, locationHydrated && hasStoredLocation)}
        </p>
        <p className="sr-only" id="dash-section-shortcuts-hint">
          Keyboard: Arrow keys cycle overview then LCARS sections in order (up or left for previous, down
          or right for next). Alt+0 is overview; Alt+1–9 jump by section number. Sounds play on each jump.
        </p>
        <div className="control-pills" aria-label="Auxiliary controls">
          {controlPills.map((pill) => (
            <a
              key={pill.targetId}
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
            <strong>{locationHydrated && hasStoredLocation ? location.label : "Awaiting helm fix"}</strong>
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
