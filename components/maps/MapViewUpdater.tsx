"use client";

import type { LatLngExpression } from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

function readLatLng(center: LatLngExpression): [number, number] {
  if (Array.isArray(center)) {
    return [center[0], center[1]];
  }
  return [center.lat, center.lng];
}

/** Keeps the map aligned with dashboard station coords when they change (deps use lat/lng, not array identity). */
export function MapViewUpdater({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();
  const [lat, lng] = readLatLng(center);

  useEffect(() => {
    map.setView([lat, lng], Math.min(zoom, map.getMaxZoom()));
  }, [map, lat, lng, zoom]);

  return null;
}
