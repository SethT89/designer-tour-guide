"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { categoryLabel, type PlaceCategory } from "@/lib/categories";
import { PlacePhoto } from "@/components/PlacePhoto";
import { publishPlace, rejectPlace } from "@/app/admin/actions";
import type { AdminPlace } from "@/lib/admin/places";

const PinPicker = dynamic(
  () => import("@/components/PinPicker").then((m) => m.PinPicker),
  { ssr: false },
);

export function PlaceReviewCard({ place }: { place: AdminPlace }) {
  const [rejecting, setRejecting] = useState(false);

  return (
    <article className="border border-rule p-4">
      <p className="label">
        {categoryLabel(place.category as PlaceCategory)}
      </p>
      <h2 className="mt-1 font-display text-2xl leading-tight">{place.name}</h2>

      {place.why && (
        <p className="mt-2 border-l-2 border-accent pl-3 leading-relaxed">
          {place.why}
        </p>
      )}
      {place.description && (
        <p className="mt-2 leading-relaxed text-muted">{place.description}</p>
      )}

      {place.tags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {place.tags.map((t) => (
            <li key={t} className="label border border-rule px-2 py-0.5">
              {t}
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-3 space-y-1 text-sm">
        <Row label="Address">{place.address || "—"}</Row>
        <Row label="City / Country">
          {[place.city, place.country].filter(Boolean).join(", ") || "—"}
        </Row>
        <Row label="Coordinates">
          {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
        </Row>
        {place.external_url && (
          <Row label="Link">
            <a
              href={place.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="!text-accent underline"
            >
              {place.external_url}
            </a>
          </Row>
        )}
        <Row label="Submitter">{place.submitter_email || "anonymous"}</Row>
        {place.submitter_note && (
          <Row label="Note">{place.submitter_note}</Row>
        )}
        <Row label="Submitted">
          {new Date(place.created_at).toLocaleString()}
        </Row>
      </dl>

      <div className="mt-3">
        <PinPicker
          value={{ lat: place.lat, lng: place.lng }}
          onChange={() => {}}
          readOnly
        />
      </div>

      {place.photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {place.photos.map((ph) => (
            <PlacePhoto
              key={ph.id}
              storagePath={ph.storage_path}
              alt={ph.alt || place.name}
              width={240}
              height={180}
              className="h-24 w-full border border-rule object-cover"
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <form action={publishPlace.bind(null, place.id)}>
          <button className="bg-accent px-4 py-1.5 font-sans text-sm text-paper">
            Publish
          </button>
        </form>
        <button
          type="button"
          onClick={() => setRejecting((v) => !v)}
          className="label border border-rule px-3 py-1.5"
        >
          Reject
        </button>
        <Link
          href={`/admin/${place.id}/edit`}
          className="label border border-ink px-3 py-1.5 !text-ink"
        >
          Edit
        </Link>
      </div>

      {rejecting && (
        <form
          action={rejectPlace.bind(null, place.id)}
          className="mt-3 flex gap-2"
        >
          <input
            name="rejection_reason"
            placeholder="Reason (optional)"
            className="w-full border border-rule bg-paper px-3 py-1.5 text-sm outline-none focus:border-ink"
          />
          <button className="bg-ink px-4 py-1.5 font-sans text-sm text-paper">
            Confirm
          </button>
        </form>
      )}
    </article>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <dt className="label shrink-0 pt-0.5">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
