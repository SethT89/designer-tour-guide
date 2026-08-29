import { notFound } from "next/navigation";
import Link from "next/link";
import { getPlaceForAdmin } from "@/lib/admin/places";
import { updatePlace, publishPlace } from "@/app/admin/actions";
import { PlaceForm, type PlaceFormValues } from "@/components/PlaceForm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function EditPlacePage({ params }: Params) {
  const { id } = await params;
  const place = await getPlaceForAdmin(id);
  if (!place) notFound();

  const initial: Partial<PlaceFormValues> = {
    name: place.name,
    address: place.address,
    city: place.city,
    country: place.country,
    lat: place.lat,
    lng: place.lng,
    category: place.category,
    tags: place.tags.join(", "),
    description: place.description,
    why: place.why,
    external_url: place.external_url ?? "",
    photos: place.photos.map((p) => ({
      id: p.id,
      storage_path: p.storage_path,
      alt: p.alt,
    })),
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Edit — {place.name}</h1>
        <span className="label">{place.status}</span>
      </div>

      {place.status === "pending" && (
        <form
          action={publishPlace.bind(null, place.id)}
          className="border border-rule p-3"
        >
          <p className="label mb-2">
            Save your edits first, then publish.
          </p>
          <button className="bg-accent px-4 py-1.5 font-sans text-sm text-paper">
            Publish now
          </button>
        </form>
      )}

      <PlaceForm
        mode="admin-edit"
        initial={initial}
        action={updatePlace.bind(null, place.id)}
      />

      <Link href="/admin" className="label inline-block !text-muted">
        ← Back to the queue
      </Link>
    </section>
  );
}
