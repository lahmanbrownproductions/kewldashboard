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
};

const DashboardLocationContext = createContext<DashboardLocationContextValue | null>(null);

export function DashboardLocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<DashboardLocation>(DEFAULT_DASHBOARD_LOCATION);

  useLayoutEffect(() => {
    const saved = parseDashboardLocation(window.localStorage.getItem(DASHBOARD_LOCATION_STORAGE_KEY));

    if (saved) {
      setLocationState(saved);
    }
  }, []);

  const setLocation = useCallback((next: DashboardLocation) => {
    setLocationState(next);
    window.localStorage.setItem(DASHBOARD_LOCATION_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const value = useMemo(
    () => ({
      location,
      setLocation,
    }),
    [location, setLocation],
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
