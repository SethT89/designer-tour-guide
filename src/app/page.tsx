import { getPublishedPlaces } from "@/lib/places";
import { placesToGeoJSON } from "@/lib/geojson";
import { HomeMap } from "@/components/HomeMap";

// Reads the DB per request — never prerender (CI build has no real Supabase).
export const dynamic = "force-dynamic";

export default async function Home() {
  const places = await getPublishedPlaces();
  return (
    <main className="h-dvh w-full">
      <HomeMap data={placesToGeoJSON(places)} />
    </main>
  );
}
