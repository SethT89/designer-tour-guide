"use client";

import { PLACE_CATEGORIES, categoryLabel } from "@/lib/categories";
import type { PlaceCategory } from "@/lib/categories";

type Props = {
  selected: PlaceCategory | null;
  onChange: (value: PlaceCategory | null) => void;
};

export function CategoryFilter({ selected, onChange }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Chip active={selected === null} onClick={() => onChange(null)}>
        All
      </Chip>
      {PLACE_CATEGORIES.map((c) => (
        <Chip key={c} active={selected === c} onClick={() => onChange(c)}>
          {categoryLabel(c)}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
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
      className={`label whitespace-nowrap border px-3 py-1.5 transition-colors ${
        active
          ? "border-ink bg-ink !text-paper"
          : "border-rule bg-transparent hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
}
