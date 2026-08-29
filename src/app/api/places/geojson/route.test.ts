import { describe, it, expect, vi, beforeEach } from "vitest";

const { getPublishedPlaces } = vi.hoisted(() => ({
  getPublishedPlaces: vi.fn(),
}));

vi.mock("@/lib/places", () => ({ getPublishedPlaces }));

beforeEach(() => getPublishedPlaces.mockReset());

import { GET } from "./route";

describe("GET /api/places/geojson", () => {
  it("returns a FeatureCollection with a cache header", async () => {
    getPublishedPlaces.mockResolvedValue([
      {
        id: "1",
        name: "X",
        slug: "x",
        category: "shop",
        lng: -96.8,
        lat: 32.8,
        description: "",
        why: "",
        tags: [],
        address: "",
        city: "Dallas",
        country: "USA",
        external_url: null,
        published_at: null,
        photos: [],
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage");
    const body = await res.json();
    expect(body.type).toBe("FeatureCollection");
    expect(body.features).toHaveLength(1);
    expect(body.features[0].geometry.coordinates).toEqual([-96.8, 32.8]);
  });

  it("returns 500 when the data layer misbehaves", async () => {
    // getPublishedPlaces throwing is caught the same way; a bad shape is the
    // simplest trigger that doesn't leave a floating rejected promise for
    // Vitest to flag.
    getPublishedPlaces.mockResolvedValue(null as unknown as never);
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
