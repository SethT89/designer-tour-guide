// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  getAdminUser,
  parsePlaceInput,
  uploadPlacePhotos,
  deletePlacePhotos,
  revalidatePath,
  eq,
  updateFn,
  selectEq,
  deleteIn,
  insertFn,
  rpc,
  from,
} = vi.hoisted(() => {
  const eq = vi.fn();
  const updateFn = vi.fn<(patch: Record<string, unknown>) => { eq: typeof eq }>(
    () => ({ eq }),
  );
  const selectEq = vi.fn();
  const selectFn = vi.fn(() => ({ eq: selectEq }));
  const deleteIn = vi.fn();
  const deleteFn = vi.fn(() => ({ in: deleteIn }));
  const insertFn = vi.fn();
  return {
    getAdminUser: vi.fn(),
    parsePlaceInput: vi.fn(),
    uploadPlacePhotos: vi.fn(),
    deletePlacePhotos: vi.fn(),
    revalidatePath: vi.fn(),
    eq,
    updateFn,
    selectEq,
    deleteIn,
    insertFn,
    rpc: vi.fn(),
    from: vi.fn(() => ({
      update: updateFn,
      select: selectFn,
      delete: deleteFn,
      insert: insertFn,
    })),
  };
});

vi.mock("@/lib/supabase/auth", () => ({ getAdminUser }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from, rpc }) }));
vi.mock("@/lib/storage", () => ({ uploadPlacePhotos, deletePlacePhotos }));
vi.mock("@/lib/place-input", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/place-input")>(
      "@/lib/place-input",
    );
  return { ...actual, parsePlaceInput };
});
vi.mock("next/cache", () => ({ revalidatePath }));

import {
  publishPlace,
  rejectPlace,
  unpublishPlace,
  updatePlace,
  createPlaceDirectly,
} from "./actions";

const value = {
  name: "Nasher",
  slug: "nasher",
  description: "d",
  why: "w",
  category: "museum_gallery",
  tags: ["a"],
  address: "addr",
  city: "Dallas",
  country: "USA",
  external_url: null,
  lat: 32.78,
  lng: -96.8,
};

function fd(entries: Record<string, string> = {}, photos: File[] = []) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  for (const p of photos) f.append("photos", p);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  getAdminUser.mockResolvedValue({ email: "admin@example.com" });
  parsePlaceInput.mockReturnValue({ ok: true, value });
  eq.mockResolvedValue({ error: null });
  selectEq.mockResolvedValue({ data: [] });
  deleteIn.mockResolvedValue({ error: null });
  insertFn.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ data: "new-id", error: null });
  uploadPlacePhotos.mockResolvedValue(["new-id/a.webp"]);
});

describe("authorization", () => {
  it("every action refuses an anonymous caller", async () => {
    getAdminUser.mockResolvedValue(null);
    await expect(publishPlace("x")).rejects.toThrow("Not authorized");
    await expect(rejectPlace("x", fd())).rejects.toThrow("Not authorized");
    await expect(unpublishPlace("x")).rejects.toThrow("Not authorized");
    await expect(updatePlace("x", fd())).rejects.toThrow("Not authorized");
    await expect(createPlaceDirectly(fd())).rejects.toThrow("Not authorized");
  });
});

describe("publishPlace", () => {
  it("sets status published with a timestamp and revalidates", async () => {
    await publishPlace("p1");
    expect(from).toHaveBeenCalledWith("places");
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: "published" }),
    );
    const patch = updateFn.mock.calls[0][0];
    expect(patch.published_at).toBeTypeOf("string");
    expect(eq).toHaveBeenCalledWith("id", "p1");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
});

describe("rejectPlace", () => {
  it("stores the reason", async () => {
    await rejectPlace("p1", fd({ rejection_reason: "off-topic" }));
    expect(updateFn).toHaveBeenCalledWith({
      status: "rejected",
      rejection_reason: "off-topic",
    });
  });
});

describe("unpublishPlace", () => {
  it("returns the place to the queue", async () => {
    await unpublishPlace("p1");
    expect(updateFn).toHaveBeenCalledWith({
      status: "pending",
      published_at: null,
    });
  });
});

describe("updatePlace", () => {
  it("updates scalars, moves the pin, and revalidates", async () => {
    const res = await updatePlace("p1", fd());
    expect(res).toEqual({ ok: true });
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Nasher", tags: ["a"] }),
    );
    expect(rpc).toHaveBeenCalledWith("set_place_point", {
      p_id: "p1",
      p_lng: -96.8,
      p_lat: 32.78,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/place/[slug]", "page");
  });

  it("returns an error for invalid input", async () => {
    parsePlaceInput.mockReturnValue({ ok: false, errors: {} });
    expect(await updatePlace("p1", fd())).toEqual({
      ok: false,
      error: "Please check the form.",
    });
  });

  it("deletes photos dropped from kept_photo_ids", async () => {
    selectEq.mockResolvedValue({
      data: [
        { id: "keep", storage_path: "p1/keep.webp" },
        { id: "drop", storage_path: "p1/drop.webp" },
      ],
    });
    await updatePlace("p1", fd({ kept_photo_ids: JSON.stringify(["keep"]) }));
    expect(deleteIn).toHaveBeenCalledWith("id", ["drop"]);
    expect(deletePlacePhotos).toHaveBeenCalledWith(["p1/drop.webp"]);
  });
});

describe("createPlaceDirectly", () => {
  it("inserts a published place and returns its slug", async () => {
    const photo = new File(["x"], "a.webp", { type: "image/webp" });
    const res = await createPlaceDirectly(fd({}, [photo]));
    expect(res.ok).toBe(true);
    expect(res.slug).toMatch(/^nasher-[0-9a-f]{8}$/);
    expect(rpc).toHaveBeenCalledWith(
      "insert_place",
      expect.objectContaining({
        p: expect.objectContaining({ status: "published" }),
      }),
    );
    expect(uploadPlacePhotos).toHaveBeenCalled();
    expect(insertFn).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
});
