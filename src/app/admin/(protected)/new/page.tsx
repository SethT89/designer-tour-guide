import { createPlaceDirectly } from "@/app/admin/actions";
import { PlaceForm } from "@/components/PlaceForm";

export const dynamic = "force-dynamic";

export default function NewPlacePage() {
  return (
    <section className="space-y-4">
      <h1 className="font-display text-2xl">Add a place</h1>
      <p className="label">Publishes immediately — no review step.</p>
      <PlaceForm mode="admin-create" action={createPlaceDirectly} />
    </section>
  );
}
