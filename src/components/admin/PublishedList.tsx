"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { categoryLabel, type PlaceCategory } from "@/lib/categories";
import { unpublishPlace } from "@/app/admin/actions";
import type { AdminPlace } from "@/lib/admin/places";

export function PublishedList({ places }: { places: AdminPlace[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return places;
    return places.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.city.toLowerCase().includes(needle) ||
        p.category.toLowerCase().includes(needle),
    );
  }, [places, q]);

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter by name, city, category"
        className="w-full border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-ink"
      />
      {filtered.length === 0 ? (
        <p className="label">No matches.</p>
      ) : (
        <ul className="divide-y divide-rule border border-rule">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate font-display text-lg leading-tight">
                  {p.name}
                </p>
                <p className="label">
                  {categoryLabel(p.category as PlaceCategory)}
                  {p.city ? ` · ${p.city}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/admin/${p.id}/edit`}
                  className="label border border-ink px-2.5 py-1 !text-ink"
                >
                  Edit
                </Link>
                <form action={unpublishPlace.bind(null, p.id)}>
                  <button className="label border border-rule px-2.5 py-1">
                    Unpublish
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
