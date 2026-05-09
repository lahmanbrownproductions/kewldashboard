"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DASHBOARD_LOCATION_STORAGE_KEY,
  DEFAULT_DASHBOARD_LOCATION,
  type DashboardLocation,
  parseDashboardLocation,
} from "@/lib/dashboard-location";

type DashboardLocationContextValue = {
  location: DashboardLocation;
  setLocation: (next: DashboardLocation) => void;
  /** True only when this browser already has coordinates saved — not merely the seeded default. */
  hasStoredLocation: boolean;
  /** False until localStorage has been read (avoids flashing the seeded default as a "real" place). */
  locationHydrated: boolean;
};

const DashboardLocationContext = createContext<DashboardLocationContextValue | null>(null);

export function DashboardLocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<DashboardLocation>(DEFAULT_DASHBOARD_LOCATION);
  const [hasStoredLocation, setHasStoredLocation] = useState(false);
  const [locationHydrated, setLocationHydrated] = useState(false);

  useLayoutEffect(() => {
    const saved = parseDashboardLocation(window.localStorage.getItem(DASHBOARD_LOCATION_STORAGE_KEY));

    if (saved) {
      setLocationState(saved);
      setHasStoredLocation(true);
    } else {
      setHasStoredLocation(false);
    }
    setLocationHydrated(true);
  }, []);

  const setLocation = useCallback((next: DashboardLocation) => {
    setHasStoredLocation(true);
    setLocationState(next);
    window.localStorage.setItem(DASHBOARD_LOCATION_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const value = useMemo(
    () => ({
      location,
      setLocation,
      hasStoredLocation,
      locationHydrated,
    }),
    [location, setLocation, hasStoredLocation, locationHydrated],
  );

  return (
    <DashboardLocationContext.Provider value={value}>{children}</DashboardLocationContext.Provider>
  );
}

export function useDashboardLocation() {
  const context = useContext(DashboardLocationContext);

  if (!context) {
    throw new Error("useDashboardLocation must be used within DashboardLocationProvider");
  }

  return context;
}
