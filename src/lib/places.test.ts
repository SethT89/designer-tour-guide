import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PlacePublic } from "./types";

const from = vi.fn();
vi.mock("./supabase/server", () => ({
  createServerClient: () => ({ from }),
}));

import { getPublishedPlaces, getPlaceBySlug } from "./places";

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

beforeEach(() => from.mockReset());

describe("getPublishedPlaces", () => {
  it("returns rows ordered by city then name", async () => {
    const order2 = vi.fn().mockResolvedValue({ data: [row], error: null });
    const order1 = vi.fn().mockReturnValue({ order: order2 });
    const select = vi.fn().mockReturnValue({ order: order1 });
    from.mockReturnValue({ select });

    const places = await getPublishedPlaces();

    expect(from).toHaveBeenCalledWith("places_public");
    expect(order1).toHaveBeenCalledWith("city");
    expect(order2).toHaveBeenCalledWith("name");
    expect(places).toEqual([row]);
  });

  it("throws on a query error", async () => {
    const order2 = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "boom" } });
    const order1 = vi.fn().mockReturnValue({ order: order2 });
    const select = vi.fn().mockReturnValue({ order: order1 });
    from.mockReturnValue({ select });

    await expect(getPublishedPlaces()).rejects.toThrow("boom");
  });
});

describe("getPlaceBySlug", () => {
  it("returns a single row or null", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    from.mockReturnValue({ select });

    const place = await getPlaceBySlug("nasher-sculpture-center");

    expect(eq).toHaveBeenCalledWith("slug", "nasher-sculpture-center");
    expect(place).toEqual(row);
  });
});

