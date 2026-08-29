import { getPlacesByStatus } from "@/lib/admin/places";
import { PlaceReviewCard } from "@/components/admin/PlaceReviewCard";

export const dynamic = "force-dynamic";

export default async function AdminQueue() {
  const pending = await getPlacesByStatus("pending");

  return (
    <section className="space-y-4">
      <h1 className="font-display text-2xl">Review queue</h1>
      {pending.length === 0 ? (
        <p className="label">Nothing waiting.</p>
      ) : (
        pending.map((place) => (
          <PlaceReviewCard key={place.id} place={place} />
        ))
      )}
    </section>
  );
}
