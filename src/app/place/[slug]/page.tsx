import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPlaceBySlug } from "@/lib/places";
import { categoryLabel } from "@/lib/categories";
import { openInMapsUrl } from "@/lib/maps-link";
import { NoPhoto } from "@/components/no-photo";

type Params = { params: Promise<{ slug: string }> };

// Rendered per request; no generateStaticParams, no build-time DB access.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);
  if (!place) return { title: "Place not found — Designer Map" };
  return {
    title: `${place.name} — Designer Map`,
    description: place.why || place.description,
  };
}

export default async function PlacePage({ params }: Params) {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);
  if (!place) notFound();

  return (
    <main className="mx-auto max-w-2xl pb-20">
      <div className="h-60 w-full overflow-hidden border-b border-rule sm:h-80">
        <NoPhoto category={place.category} />
      </div>

      <div className="space-y-6 px-5 pt-6">
        <header className="space-y-2">
          <p className="label">{categoryLabel(place.category)}</p>
          <h1 className="font-display text-3xl leading-[1.1] tracking-[-0.015em] sm:text-4xl">
            {place.name}
          </h1>
        </header>

        {place.why && (
          <p className="border-l-2 border-accent pl-4 text-lg leading-relaxed">
            {place.why}
          </p>
        )}
        {place.description && (
          <p className="leading-relaxed text-muted">{place.description}</p>
        )}

        {place.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {place.tags.map((t) => (
              <li key={t} className="label border border-rule px-2 py-1">
                {t}
              </li>
            ))}
          </ul>
        )}

        <div className="border-y border-rule py-4">
          <p className="text-sm">{place.address}</p>
          <a
            className="label mt-2 inline-block !text-accent underline decoration-1 underline-offset-4"
            href={openInMapsUrl({
              name: place.name,
              lat: place.lat,
              lng: place.lng,
            })}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in Maps →
          </a>
        </div>

        {place.external_url && (
          <a
            className="label inline-block !text-accent underline decoration-1 underline-offset-4"
            href={place.external_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Official site →
          </a>
        )}

        <Link href="/" className="label block pt-2 !text-muted">
          ← Back to the map
        </Link>
      </div>
    </main>
  );
}
