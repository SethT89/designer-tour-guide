"use client";

import { useState } from "react";
import { MapView } from "./MapView";
import { PlacePreviewSheet } from "./PlacePreviewSheet";
import type { PlaceFeature, PlaceFeatureCollection } from "@/lib/geojson";

export function HomeMap({ data }: { data: PlaceFeatureCollection }) {
  const [selected, setSelected] = useState<PlaceFeature["properties"] | null>(
    null,
  );

  return (
    <div className="relative h-full w-full">
      <MapView data={data} onSelect={setSelected} />
      <PlacePreviewSheet place={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
