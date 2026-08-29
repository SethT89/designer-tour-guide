import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "./supabase/admin";

const BUCKET = "place-photos";

/** Uploads already-resized image blobs; returns their storage paths. */
export async function uploadPlacePhotos(
  placeId: string,
  files: File[],
): Promise<string[]> {
  const supabase = createAdminClient();
  const paths: string[] = [];
  for (const file of files.slice(0, 5)) {
    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/jpeg"
          ? "jpg"
          : "webp";
    const path = `${placeId}/${randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(`photo upload failed: ${error.message}`);
    paths.push(path);
  }
  return paths;
}

/** Removes stored photo objects by path. Best-effort; ignores missing files. */
export async function deletePlacePhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = createAdminClient();
  await supabase.storage.from(BUCKET).remove(paths);
}
