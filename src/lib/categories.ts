export const PLACE_CATEGORIES = [
  "architecture",
  "interiors",
  "graphic_signage",
  "product_furniture",
  "public_art",
  "museum_gallery",
  "shop",
  "other",
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

const LABELS: Record<PlaceCategory, string> = {
  architecture: "Architecture",
  interiors: "Interiors",
  graphic_signage: "Graphic / Signage",
  product_furniture: "Product / Furniture",
  public_art: "Public Art",
  museum_gallery: "Museum / Gallery",
  shop: "Shop",
  other: "Other",
};

export function categoryLabel(value: PlaceCategory): string {
  return LABELS[value] ?? value;
}
