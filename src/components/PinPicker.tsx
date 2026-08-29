"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import { getMapConfig } from "@/lib/config";
import { configureMapLibre } from "@/lib/maplibre";

export type LatLng = { lat: number; lng: number };

type Props = {
  value: LatLng | null;
  onChange: (v: LatLng) => void;
  /** Read-only: show the pin but don't allow dragging (review cards). */
  readOnly?: boolean;
};

export function PinPicker({ value, onChange, readOnly = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!containerRef.current) return;
    configureMapLibre();
    const { center, styleUrl } = getMapConfig();
    const start: [number, number] = value
      ? [value.lng, value.lat]
      : (center as [number, number]);

    const map = new MapLibreMap({
      container: containerRef.current,
      style: styleUrl,
      center: start,
      zoom: value ? 15 : 11,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    const marker = new Marker({ draggable: !readOnly })
      .setLngLat(start)
      .addTo(map);
    markerRef.current = marker;

    if (!readOnly) {
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLngLat();
        onChangeRef.current({ lat, lng });
      });
      // Tap anywhere on the map to drop the pin there.
      map.on("click", (e) => {
        marker.setLngLat(e.lngLat);
        onChangeRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });
      map.getCanvas().style.cursor = "crosshair";
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // External value changes move the marker; only recentre the map when the
  // point is off-screen (a geocode jump), not for an in-view tap or drag.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || !value) return;
    marker.setLngLat([value.lng, value.lat]);
    let visible = false;
    try {
      visible = map.getBounds().contains([value.lng, value.lat]);
    } catch {
      visible = false;
    }
    if (!visible) {
      map.easeTo({ center: [value.lng, value.lat], zoom: 15 });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      data-testid="pin-picker"
      className="h-60 w-full border border-rule"
    />
  );
}
