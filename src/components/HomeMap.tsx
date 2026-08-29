"use client";

import { MapView } from "./MapView";
import type { PlaceFeatureCollection } from "@/lib/geojson";

export function HomeMap({ data }: { data: PlaceFeatureCollection }) {
  return (
    <MapView data={data} onSelect={(p) => console.log("selected", p.slug)} />
  );
}
