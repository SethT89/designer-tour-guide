import { describe, it, expect, vi, beforeEach } from "vitest";

const from = vi.fn();
vi.mock("../supabase/admin", () => ({
  createAdminClient: () => ({ from }),
}));

import { getPlacesByStatus, getPlaceForAdmin } from "./places";

const placeRow = {
  id: "p1",
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
  google_maps_url: null,
  status: "pending",
  submitter_email: "fan@example.com",
  submitter_note: "please add",
  rejection_reason: null,
  created_at: "2026-08-28T00:00:00Z",
  published_at: null,
};

const photoRow = {
  id: "ph1",
  place_id: "p1",
  storage_path: "p1/a.webp",
  alt: "",
  sort_order: 0,
};

/** places_admin query chain: .select().eq().order() -> result */
function mockPlacesAdmin(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq, order };
}

/** place_photos query chain: .select().in().order() -> result */
function mockPlacePhotos(result: { data: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const inFn = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ in: inFn });
  return { select, in: inFn, order };
}

beforeEach(() => from.mockReset());

describe("getPlacesByStatus", () => {
  it("queries places_admin filtered by status, newest first, and merges photos", async () => {
    const admin = mockPlacesAdmin({ data: [placeRow], error: null });
    const photos = mockPlacePhotos({ data: [photoRow] });
    from.mockImplementation((table: string) =>
      table === "places_admin" ? { select: admin.select } : { select: photos.select },
    );

    const result = await getPlacesByStatus("pending");

    expect(from).toHaveBeenCalledWith("places_admin");
    expect(admin.eq).toHaveBeenCalledWith("status", "pending");
    expect(admin.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(from).toHaveBeenCalledWith("place_photos");
    expect(photos.in).toHaveBeenCalledWith("place_id", ["p1"]);
    expect(result).toEqual([
      {
        ...placeRow,
        photos: [
          { id: "ph1", storage_path: "p1/a.webp", alt: "", sort_order: 0 },
        ],
      },
    ]);
  });

  it("throws on a query error", async () => {
    const admin = mockPlacesAdmin({ data: null, error: { message: "boom" } });
    from.mockReturnValue({ select: admin.select });
    await expect(getPlacesByStatus("pending")).rejects.toThrow("boom");
  });
});

describe("getPlaceForAdmin", () => {
  it("returns a single place with its photos", async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: placeRow, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const adminSelect = vi.fn().mockReturnValue({ eq });
    const photos = mockPlacePhotos({ data: [photoRow] });
    from.mockImplementation((table: string) =>
      table === "places_admin"
        ? { select: adminSelect }
        : { select: photos.select },
    );

    const result = await getPlaceForAdmin("p1");

    expect(eq).toHaveBeenCalledWith("id", "p1");
    expect(result?.photos).toHaveLength(1);
    expect(result?.name).toBe("Nasher Sculpture Center");
  });

  it("returns null when the place is missing", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) });

    expect(await getPlaceForAdmin("nope")).toBeNull();
  });
});
