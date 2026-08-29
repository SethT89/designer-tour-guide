"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, NavigationControl } from "maplibre-gl";
import { getMapConfig } from "@/lib/config";
import { configureMapLibre } from "@/lib/maplibre";
import type { PlaceFeature, PlaceFeatureCollection } from "@/lib/geojson";

type Props = {
  data: PlaceFeatureCollection;
  onSelect: (feature: PlaceFeature["properties"]) => void;
};

const SOURCE = "places";

export function MapView({ data, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const dataRef = useRef(data);
  const onSelectRef = useRef(onSelect);

  // Keep the "latest value" refs current without re-running the map effect.
  useEffect(() => {
    dataRef.current = data;
    onSelectRef.current = onSelect;
  });

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
    mapRef.current = map;
    map.addControl(new NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource(SOURCE, {
        type: "geojson",
        data: dataRef.current,
        cluster: true,
        clusterRadius: 50,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: SOURCE,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#1d1d1f",
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 30, 28],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: SOURCE,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "place",
        type: "circle",
        source: SOURCE,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#e8483c",
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "clusters", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const coords = (f.geometry as GeoJSON.Point).coordinates as [
          number,
          number,
        ];
        map.easeTo({ center: coords, zoom: map.getZoom() + 2 });
      });
      map.on("click", "place", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        onSelectRef.current(f.properties as PlaceFeature["properties"]);
      });
      for (const layer of ["clusters", "place"]) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Push new data (e.g. category filter) into the live source.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(SOURCE) as
      | { setData: (d: PlaceFeatureCollection) => void }
      | undefined;
    src?.setData(data);
  }, [data]);

  return (
    <div ref={containerRef} data-testid="base-map" className="h-full w-full" />
  );
}
