import { PlaceCard } from "./PlaceCard";
import type { PlaceCategory } from "@/lib/categories";
import type { PlacePublic } from "@/lib/types";

export function PlaceList({
  places,
  category,
}: {
  places: PlacePublic[];
  category: PlaceCategory | null;
}) {
  const shown = category
    ? places.filter((p) => p.category === category)
    : places;

  if (shown.length === 0) {
    return (
      <p className="label px-4 py-16 text-center">
        No places in this category yet.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4">
      {shown.map((p) => (
        <PlaceCard key={p.id} place={p} />
      ))}
    </div>
  );
}
