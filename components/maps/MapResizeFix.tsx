"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

/** Leaflet often mis-sizes inside CSS grid / flex until the container settles. */
export function MapResizeFix() {
  const map = useMap();

  useEffect(() => {
    const immediate = window.setTimeout(() => {
      map.invalidateSize();
    }, 0);
    const container = map.getContainer();
    const target = container.parentElement ?? container;
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(target);
    return () => {
      window.clearTimeout(immediate);
      observer.disconnect();
    };
  }, [map]);

  return null;
}
