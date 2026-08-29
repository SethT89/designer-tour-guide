import { getPublishedPlaces } from "@/lib/places";
import { HomeView } from "@/components/HomeView";

// Reads the DB per request — never prerender (CI build has no real Supabase).
export const dynamic = "force-dynamic";

export default async function Home() {
  const places = await getPublishedPlaces();
  return <HomeView places={places} />;
}
