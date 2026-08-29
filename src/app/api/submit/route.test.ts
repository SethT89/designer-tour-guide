// @vitest-environment node
// jsdom's Blob/FormData polyfills deadlock `Request.formData()` when a File is
// attached; the route parses multipart form data, so run it under Node.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { checkRateLimit, parsePlaceInput, uploadPlacePhotos, rpc, insert, from } =
  vi.hoisted(() => {
    const insert = vi.fn();
    return {
      checkRateLimit: vi.fn(),
      parsePlaceInput: vi.fn(),
      uploadPlacePhotos: vi.fn(),
      rpc: vi.fn(),
      insert,
      from: vi.fn(() => ({ insert })),
    };
  });

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/storage", () => ({ uploadPlacePhotos }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc, from }) }));
vi.mock("@/lib/place-input", async () => {
  const actual = await vi.importActual<typeof import("@/lib/place-input")>(
    "@/lib/place-input",
  );
  return { ...actual, parsePlaceInput };
});

import { POST } from "./route";

const goodValue = {
  name: "Nasher",
  slug: "nasher",
  description: "",
  why: "",
  category: "museum_gallery",
  tags: [],
  address: "",
  city: "",
  country: "",
  external_url: null,
  lat: 32.78,
  lng: -96.8,
};

function form(entries: Record<string, string>, photos: File[] = []) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  for (const p of photos) fd.append("photos", p);
  return new Request("http://localhost/api/submit", { method: "POST", body: fd });
}

beforeEach(() => {
  [checkRateLimit, parsePlaceInput, uploadPlacePhotos, rpc, insert, from].forEach(
    (m) => m.mockReset(),
  );
  from.mockReturnValue({ insert });
  checkRateLimit.mockResolvedValue({ allowed: true });
  parsePlaceInput.mockReturnValue({ ok: true, value: goodValue });
  rpc.mockResolvedValue({ data: "new-id", error: null });
  insert.mockResolvedValue({ error: null });
  uploadPlacePhotos.mockResolvedValue(["new-id/a.webp"]);
});

describe("POST /api/submit", () => {
  it("silently accepts a filled honeypot without writing", async () => {
    const res = await POST(form({ company: "bot", name: "x" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("429s when rate-limited", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });
    const res = await POST(form({ name: "x" }));
    expect(res.status).toBe(429);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("400s on invalid input with field errors", async () => {
    parsePlaceInput.mockReturnValue({ ok: false, errors: { name: "required" } });
    const res = await POST(form({ name: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toEqual({ name: "required" });
  });

  it("inserts a pending place and its photos on the happy path", async () => {
    const photo = new File(["x"], "a.webp", { type: "image/webp" });
    const res = await POST(form({ name: "Nasher" }, [photo]));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect(rpc).toHaveBeenCalledWith(
      "insert_place",
      expect.objectContaining({
        p: expect.objectContaining({ status: "pending" }),
        p_lng: -96.8,
        p_lat: 32.78,
      }),
    );
    expect(uploadPlacePhotos).toHaveBeenCalledOnce();
    const [placeId, files] = uploadPlacePhotos.mock.calls[0];
    expect(placeId).toBe("new-id");
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("a.webp");
    expect(from).toHaveBeenCalledWith("place_photos");
    expect(insert).toHaveBeenCalledWith([
      { place_id: "new-id", storage_path: "new-id/a.webp", sort_order: 0 },
    ]);
  });

  it("500s when the insert RPC fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await POST(form({ name: "Nasher" }));
    expect(res.status).toBe(500);
  });
});
