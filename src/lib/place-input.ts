import { PLACE_CATEGORIES, type PlaceCategory } from "./categories";

export type PlaceInputValue = {
  name: string;
  slug: string;
  description: string;
  why: string;
  category: PlaceCategory;
  tags: string[];
  address: string;
  city: string;
  country: string;
  external_url: string | null;
  google_maps_url: string | null;
  lat: number;
  lng: number;
};

export type ParseResult =
  | { ok: true; value: PlaceInputValue }
  | { ok: false; errors: Record<string, string> };

const MAX_TEXT = 2000;
const MAX_TAGS = 12;

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCoord(raw: string, min: number, max: number): number | null {
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function normaliseUrl(raw: string): string | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    return new URL(withScheme).toString().replace(/\/$/, "");
  } catch {
    return undefined; // signals an invalid URL
  }
}

export function parsePlaceInput(raw: Record<string, string>): ParseResult {
  const errors: Record<string, string> = {};

  const name = (raw.name ?? "").trim();
  if (name.length < 1 || name.length > 200) {
    errors.name = "A name is required (up to 200 characters).";
  }

  const category = (raw.category ?? "").trim();
  if (!PLACE_CATEGORIES.includes(category as PlaceCategory)) {
    errors.category = "Choose a category.";
  }

  const tags = Array.from(
    new Set(
      (raw.tags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ).slice(0, MAX_TAGS);

  const description = (raw.description ?? "").trim();
  if (description.length > MAX_TEXT) errors.description = "Too long.";
  const why = (raw.why ?? "").trim();
  if (why.length > MAX_TEXT) errors.why = "Too long.";

  const address = (raw.address ?? "").trim();
  const city = (raw.city ?? "").trim();
  const country = (raw.country ?? "").trim();

  const lat = parseCoord(raw.lat ?? "", -90, 90);
  if (lat === null) errors.lat = "Pick a point on the map.";
  const lng = parseCoord(raw.lng ?? "", -180, 180);
  if (lng === null) errors.lng = "Pick a point on the map.";

  const external_url = normaliseUrl(raw.external_url ?? "");
  if (external_url === undefined) errors.external_url = "Not a valid URL.";

  const google_maps_url = normaliseUrl(raw.google_maps_url ?? "");
  if (google_maps_url === undefined)
    errors.google_maps_url = "Not a valid URL.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      slug: slugify(name),
      description,
      why,
      category: category as PlaceCategory,
      tags,
      address,
      city,
      country,
      external_url: external_url ?? null,
      google_maps_url: google_maps_url ?? null,
      lat: lat as number,
      lng: lng as number,
    },
  };
}
