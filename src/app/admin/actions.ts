"use server";

import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePlaceInput, slugify } from "@/lib/place-input";
import { shortId } from "@/lib/slug";
import { uploadPlacePhotos, deletePlacePhotos } from "@/lib/storage";
import type { PlaceFormResult } from "@/components/PlaceForm";

const FIELDS = [
  "name",
  "category",
  "tags",
  "description",
  "why",
  "address",
  "city",
  "country",
  "lat",
  "lng",
  "external_url",
] as const;

async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) throw new Error("Not authorized");
}

function revalidatePublic() {
  revalidatePath("/");
  revalidatePath("/place/[slug]", "page");
  revalidatePath("/admin");
}

export async function publishPlace(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("places")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePublic();
}

export async function rejectPlace(id: string, formData: FormData) {
  await requireAdmin();
  const reason = String(formData.get("rejection_reason") ?? "").trim();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("places")
    .update({ status: "rejected", rejection_reason: reason })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function unpublishPlace(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("places")
    .update({ status: "pending", published_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePublic();
}

function readFields(formData: FormData): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const f of FIELDS) raw[f] = String(formData.get(f) ?? "");
  return raw;
}

function newFiles(formData: FormData): File[] {
  return formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
}

export async function updatePlace(
  id: string,
  formData: FormData,
): Promise<PlaceFormResult> {
  await requireAdmin();
  const parsed = parsePlaceInput(readFields(formData));
  if (!parsed.ok) {
    return { ok: false, error: "Please check the form." };
  }
  const v = parsed.value;
  const supabase = createAdminClient();

  const { error: updateError } = await supabase
    .from("places")
    .update({
      name: v.name,
      description: v.description,
      why: v.why,
      category: v.category,
      tags: v.tags,
      address: v.address,
      city: v.city,
      country: v.country,
      external_url: v.external_url,
    })
    .eq("id", id);
  if (updateError) return { ok: false, error: updateError.message };

  const { error: pointError } = await supabase.rpc("set_place_point", {
    p_id: id,
    p_lng: v.lng,
    p_lat: v.lat,
  });
  if (pointError) return { ok: false, error: pointError.message };

  await syncPhotos(supabase, id, formData);

  revalidatePublic();
  return { ok: true };
}

export async function createPlaceDirectly(
  formData: FormData,
): Promise<PlaceFormResult> {
  await requireAdmin();
  const parsed = parsePlaceInput(readFields(formData));
  if (!parsed.ok) {
    return { ok: false, error: "Please check the form." };
  }
  const v = parsed.value;
  const slug = `${slugify(v.name)}-${shortId()}`;
  const supabase = createAdminClient();

  const { data: newId, error } = await supabase.rpc("insert_place", {
    p: { ...v, slug, status: "published", published_at: "now" },
    p_lng: v.lng,
    p_lat: v.lat,
  });
  if (error) return { ok: false, error: error.message };

  const files = newFiles(formData);
  if (files.length > 0) {
    const paths = await uploadPlacePhotos(newId as string, files);
    await supabase.from("place_photos").insert(
      paths.map((storage_path, i) => ({
        place_id: newId,
        storage_path,
        sort_order: i,
      })),
    );
  }

  revalidatePath("/");
  return { ok: true, slug };
}

/** Delete removed photos, upload any new ones, keep sort order stable. */
async function syncPhotos(
  supabase: ReturnType<typeof createAdminClient>,
  placeId: string,
  formData: FormData,
) {
  let kept: string[] = [];
  try {
    kept = JSON.parse(String(formData.get("kept_photo_ids") ?? "[]"));
  } catch {
    kept = [];
  }

  const { data: existing } = await supabase
    .from("place_photos")
    .select("id,storage_path")
    .eq("place_id", placeId);

  const remove = (existing ?? []).filter((p) => !kept.includes(p.id));
  if (remove.length > 0) {
    await supabase
      .from("place_photos")
      .delete()
      .in(
        "id",
        remove.map((p) => p.id),
      );
    await deletePlacePhotos(remove.map((p) => p.storage_path));
  }

  const files = newFiles(formData);
  if (files.length > 0) {
    const paths = await uploadPlacePhotos(placeId, files);
    await supabase.from("place_photos").insert(
      paths.map((storage_path, i) => ({
        place_id: placeId,
        storage_path,
        sort_order: kept.length + i,
      })),
    );
  }
}
