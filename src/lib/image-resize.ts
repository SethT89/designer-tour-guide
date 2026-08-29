const DEFAULT_MAX_EDGE = 1600;
const WEBP_QUALITY = 0.85;

/**
 * Resize an image File so its longest edge is at most `maxEdge`, re-encoding to
 * WebP. A file already within bounds is returned unchanged. Browser-only (uses
 * `createImageBitmap` + `<canvas>`).
 */
export async function resizeImage(
  file: File,
  maxEdge = DEFAULT_MAX_EDGE,
): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Not an image");
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const longest = Math.max(width, height);

  if (longest <= maxEdge) {
    bitmap.close?.();
    return file;
  }

  const scale = maxEdge / longest;
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
  );
  if (!blob) throw new Error("Image encoding failed");

  const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], name, { type: "image/webp" });
}
