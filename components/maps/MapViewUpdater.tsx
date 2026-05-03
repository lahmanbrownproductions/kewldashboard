"use client";

import type { LatLngExpression } from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

export function MapViewUpdater({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, Math.min(zoom, map.getMaxZoom()));
  }, [map, center, zoom]);

  return null;
}
