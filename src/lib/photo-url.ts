const BUCKET = "place-photos";

/** Public URL for a stored photo. Safe for the browser (only NEXT_PUBLIC). */
export function photoUrl(storagePath: string): string {
  if (/^https?:\/\//.test(storagePath)) return storagePath;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}
