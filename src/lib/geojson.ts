import type { PlaceCategory } from "./categories";
import type { PlacePublic } from "./types";

export type PlaceFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    id: string;
    name: string;
    slug: string;
    category: PlaceCategory;
    /** Storage path of the first photo, or null. */
    thumb: string | null;
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
        thumb:
          [...p.photos].sort((a, b) => a.sort_order - b.sort_order)[0]
            ?.storage_path ?? null,
      },
    })),
  };
}
