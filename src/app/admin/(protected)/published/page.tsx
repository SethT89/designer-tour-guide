import { getPlacesByStatus } from "@/lib/admin/places";
import { PublishedList } from "@/components/admin/PublishedList";

export const dynamic = "force-dynamic";

export default async function PublishedPage() {
  const places = await getPlacesByStatus("published");

  return (
    <section className="space-y-4">
      <h1 className="font-display text-2xl">Published ({places.length})</h1>
      <PublishedList places={places} />
    </section>
  );
}
