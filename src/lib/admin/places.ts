import "server-only";
import { createAdminClient } from "../supabase/admin";
import type { PlaceStatus } from "../types";

const COLUMNS =
  "id,name,slug,description,why,category,tags,lng,lat,address,city,country,external_url,google_maps_url,status,submitter_email,submitter_note,rejection_reason,created_at,published_at";

export type AdminPlace = {
  id: string;
  name: string;
  slug: string;
  description: string;
  why: string;
  category: string;
  tags: string[];
  lng: number;
  lat: number;
  address: string;
  city: string;
  country: string;
  external_url: string | null;
  google_maps_url: string | null;
  status: PlaceStatus;
  submitter_email: string | null;
  submitter_note: string | null;
  rejection_reason: string | null;
  created_at: string;
  published_at: string | null;
  photos: { id: string; storage_path: string; alt: string; sort_order: number }[];
};

export async function getPlacesByStatus(
  status: PlaceStatus,
): Promise<AdminPlace[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("places_admin")
    .select(COLUMNS)
    .eq("status", status)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<AdminPlace, "photos">[];
  return attachPhotos(supabase, rows);
}

export async function getPlaceForAdmin(id: string): Promise<AdminPlace | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("places_admin")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [withPhotos] = await attachPhotos(supabase, [
    data as Omit<AdminPlace, "photos">,
  ]);
  return withPhotos;
}

async function attachPhotos(
  supabase: ReturnType<typeof createAdminClient>,
  rows: Omit<AdminPlace, "photos">[],
): Promise<AdminPlace[]> {
  if (rows.length === 0) return [];
  const { data } = await supabase
    .from("place_photos")
    .select("id,place_id,storage_path,alt,sort_order")
    .in(
      "place_id",
      rows.map((r) => r.id),
    )
    .order("sort_order");
  const byPlace = new Map<string, AdminPlace["photos"]>();
  for (const p of data ?? []) {
    const list = byPlace.get(p.place_id) ?? [];
    list.push({
      id: p.id,
      storage_path: p.storage_path,
      alt: p.alt,
      sort_order: p.sort_order,
    });
    byPlace.set(p.place_id, list);
  }
  return rows.map((r) => ({ ...r, photos: byPlace.get(r.id) ?? [] }));
}
