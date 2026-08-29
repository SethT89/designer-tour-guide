"use client";

import { useMemo, useState } from "react";
import { MapView } from "./MapView";
import { PlacePreviewSheet } from "./PlacePreviewSheet";
import { PlaceList } from "./PlaceList";
import { CategoryFilter } from "./CategoryFilter";
import { placesToGeoJSON } from "@/lib/geojson";
import type { PlaceCategory } from "@/lib/categories";
import type { PlaceFeature } from "@/lib/geojson";
import type { PlacePublic } from "@/lib/types";

export function HomeView({ places }: { places: PlacePublic[] }) {
  const [view, setView] = useState<"map" | "list">("map");
  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [selected, setSelected] = useState<PlaceFeature["properties"] | null>(
    null,
  );

  const filtered = useMemo(
    () => (category ? places.filter((p) => p.category === category) : places),
    [places, category],
  );
  const geojson = useMemo(() => placesToGeoJSON(filtered), [filtered]);

  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b border-rule">
        <div className="flex items-stretch justify-between border-b border-rule">
          <h1 className="label flex items-center pl-4 !text-ink">
            Designer Map
          </h1>
          <div className="flex shrink-0">
            <Toggle active={view === "map"} onClick={() => setView("map")}>
              Map
            </Toggle>
            <Toggle active={view === "list"} onClick={() => setView("list")}>
              List
            </Toggle>
          </div>
        </div>
        <CategoryFilter selected={category} onChange={setCategory} />
      </header>

      <div className="relative flex-1 overflow-hidden">
        {view === "map" ? (
          <>
            <MapView data={geojson} onSelect={setSelected} />
            <PlacePreviewSheet
              place={selected}
              onClose={() => setSelected(null)}
            />
          </>
        ) : (
          <div className="h-full overflow-y-auto py-2">
            <PlaceList places={places} category={category} />
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`label border-l border-rule px-4 py-3 ${
        active ? "bg-ink !text-paper" : "hover:bg-paper-dim"
      }`}
    >
      {children}
    </button>
  );
}
