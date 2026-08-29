import { categoryLabel } from "@/lib/categories";
import type { PlaceCategory } from "@/lib/categories";

/**
 * Placeholder shown until a place has a photo (Phase 2). A faint diagonal hatch
 * on paper-dim, with the category set in the monospace label voice.
 */
export function NoPhoto({ category }: { category: PlaceCategory }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-paper-dim"
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, color-mix(in srgb, #191817 5%, transparent) 0 1px, transparent 1px 9px)",
      }}
    >
      <span className="label">{categoryLabel(category)}</span>
    </div>
  );
}
