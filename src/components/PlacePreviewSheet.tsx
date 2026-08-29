"use client";

import Link from "next/link";
import { categoryLabel } from "@/lib/categories";
import { NoPhoto } from "./no-photo";
import type { PlaceFeature } from "@/lib/geojson";

type Props = {
  place: PlaceFeature["properties"] | null;
  onClose: () => void;
};

export function PlacePreviewSheet({ place, onClose }: Props) {
  if (!place) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:p-4">
      {/* backdrop */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/10"
      />

      <div
        className="relative w-full max-w-md border-t-2 border-accent bg-paper shadow-[0_-8px_40px_rgba(25,24,23,0.18)] sm:border sm:border-rule"
        style={{ animation: "sheet-up 240ms cubic-bezier(0.16,1,0.3,1)" }}
      >
        <div className="h-40 overflow-hidden border-b border-rule">
          <NoPhoto category={place.category} />
        </div>

        <div className="space-y-2 px-5 py-4">
          <p className="label">{categoryLabel(place.category)}</p>
          <h2 className="font-display text-2xl leading-tight tracking-[-0.01em]">
            {place.name}
          </h2>
          <Link
            href={`/place/${place.slug}`}
            className="label inline-block pt-1 !text-accent underline decoration-1 underline-offset-4"
          >
            View details →
          </Link>
        </div>

        <button
          aria-label="Close"
          onClick={onClose}
          className="label absolute right-4 top-3 !text-muted"
        >
          Close ✕
        </button>
      </div>

      <style>{`
        @keyframes sheet-up {
          from { transform: translateY(12px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
