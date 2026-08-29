import { describe, it, expect } from "vitest";
import { placesToGeoJSON } from "./geojson";
import type { PlacePublic } from "./types";

const row: PlacePublic = {
  id: "1",
  name: "Nasher Sculpture Center",
  slug: "nasher-sculpture-center",
  description: "d",
  why: "w",
  category: "museum_gallery",
  tags: ["renzo piano"],
  lng: -96.7986,
  lat: 32.788,
  address: "2001 Flora St",
  city: "Dallas",
  country: "USA",
  external_url: null,
  published_at: "2026-08-28T00:00:00Z",
  photos: [],
};

describe("placesToGeoJSON", () => {
  it("builds a FeatureCollection of Points with lng/lat order", () => {
    const fc = placesToGeoJSON([row]);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features[0]).toEqual({
      type: "Feature",
      geometry: { type: "Point", coordinates: [-96.7986, 32.788] },
      properties: {
        id: "1",
        name: "Nasher Sculpture Center",
        slug: "nasher-sculpture-center",
        category: "museum_gallery",
        thumb: null,
      },
    });
  });

  it("exposes the first photo's storage path as thumb", () => {
    const fc = placesToGeoJSON([
      {
        ...row,
        photos: [
          { storage_path: "1/b.webp", credit: null, alt: "", sort_order: 1 },
          { storage_path: "1/a.webp", credit: null, alt: "", sort_order: 0 },
        ],
      },
    ]);
    expect(fc.features[0].properties.thumb).toBe("1/a.webp");
  });

  it("returns an empty collection for no places", () => {
    expect(placesToGeoJSON([])).toEqual({
      type: "FeatureCollection",
      features: [],
    });
  });
});
