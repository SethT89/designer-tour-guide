import "server-only";
import { createServerClient } from "./supabase/server";
import type { PlaceCategory } from "./categories";
import type { PlacePublic } from "./types";

const COLUMNS =
  "id,name,slug,description,why,category,tags,lng,lat,address,city,country,external_url,published_at,photos";

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

export type PlaceFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    id: string;
    name: string;
    slug: string;
    category: PlaceCategory;
  };
};

export type PlaceFeatureCollection = {
  type: "FeatureCollection";
  features: PlaceFeature[];
};

export function placesToGeoJSON(places: PlacePublic[]): PlaceFeatureCollection {
  return {
    type: "FeatureCollection",
    features: places.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        name: p.name,
        slug: p.slug,
        category: p.category,
      },
    })),
  };
}
