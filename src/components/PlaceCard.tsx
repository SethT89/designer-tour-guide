import Link from "next/link";
import { categoryLabel } from "@/lib/categories";
import type { PlacePublic } from "@/lib/types";

/** An index row — hairline-ruled, name in the display serif, meta in mono. */
export function PlaceCard({ place }: { place: PlacePublic }) {
  return (
    <Link
      href={`/place/${place.slug}`}
      className="group flex items-baseline gap-4 border-b border-rule py-4 last:border-b-0"
    >
      <span className="label shrink-0 pt-1 tabular-nums">
        {categoryLabel(place.category)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-xl leading-snug tracking-[-0.01em] group-hover:text-accent">
          {place.name}
        </span>
        <span className="mt-0.5 block truncate text-sm text-muted">
          {place.address}
        </span>
      </span>
      <span className="label shrink-0 pt-1 opacity-0 transition-opacity group-hover:opacity-100">
        →
      </span>
    </Link>
  );
}
