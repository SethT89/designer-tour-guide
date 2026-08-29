import "server-only";
import { createServerClient } from "./supabase/server";
import type { PlacePublic } from "./types";

export { placesToGeoJSON } from "./geojson";
export type { PlaceFeature, PlaceFeatureCollection } from "./geojson";

const COLUMNS =
  "id,name,slug,description,why,category,tags,lng,lat,address,city,country,external_url,google_maps_url,published_at,photos";

export async function getPublishedPlaces(): Promise<PlacePublic[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("places_public")
    .select(COLUMNS)
    .order("city")
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as PlacePublic[];
}

export async function getPlaceBySlug(slug: string): Promise<PlacePublic | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("places_public")
    .select(COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as PlacePublic | null) ?? null;
}
