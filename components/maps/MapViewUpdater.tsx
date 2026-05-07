"use client";

import type { LatLngExpression } from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

function readLatLng(center: LatLngExpression): [number, number] {
  if (Array.isArray(center)) {
    return [center[0], center[1]];
  }
  return [center.lat, center.lng];
}

/** Recenters after station coords change. Initial center/zoom come from `MapContainer` — do not `setView` on first mount (avoids racing `TileLayer`). */
export function MapViewUpdater({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();
  const [lat, lng] = readLatLng(center);
  const prevTripletRef = useRef<[number, number, number] | null>(null);

  useEffect(() => {
    const next: [number, number, number] = [lat, lng, zoom];
    const prev = prevTripletRef.current;
    if (prev !== null && prev[0] === next[0] && prev[1] === next[1] && prev[2] === next[2]) {
      return;
    }
    prevTripletRef.current = next;
    if (prev === null) {
      return;
    }

    let cancelled = false;
    const applyView = () => {
      if (cancelled) {
        return;
      }
      const el = map.getContainer();
      if (!el.isConnected) {
        return;
      }
      try {
        map.setView([lat, lng], Math.min(zoom, map.getMaxZoom()));
      } catch {
        /* strict unmount / pane teardown */
      }
    };

    map.whenReady(() => {
      if (cancelled) {
        return;
      }
      requestAnimationFrame(applyView);
    });

    return () => {
      cancelled = true;
    };
  }, [map, lat, lng, zoom]);

  return null;
}
