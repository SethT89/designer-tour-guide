"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, NavigationControl } from "maplibre-gl";
import { getMapConfig } from "@/lib/config";
import { configureMapLibre } from "@/lib/maplibre";

export function BaseMap() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    configureMapLibre();
    const { center, zoom, styleUrl } = getMapConfig();

    const map = new MapLibreMap({
      container: containerRef.current,
      style: styleUrl,
      center,
      zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl(), "top-right");

    return () => map.remove();
  }, []);

  return (
    <div ref={containerRef} data-testid="base-map" className="h-dvh w-full" />
  );
}
