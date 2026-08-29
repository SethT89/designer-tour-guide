import { describe, it, expect, vi, afterEach } from "vitest";
import { POST } from "./route";

function post(url: unknown) {
  return new Request("http://localhost/api/resolve-place", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("POST /api/resolve-place", () => {
  it("400s a non-Google host", async () => {
    const res = await POST(post("https://evil.example.com/maps/place/X"));
    expect(res.status).toBe(400);
  });

  it("parses a full Google Maps place URL without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(
      post(
        "https://www.google.com/maps/place/Nasher/@32.78,-96.80,17z/data=!8m2!3d32.7876!4d-96.8001",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Nasher");
    expect(body.lat).toBeCloseTo(32.7876);
    expect(body.lng).toBeCloseTo(-96.8001);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("follows short-link redirects then parses the final URL", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://maps.google.com/maps?q=32.78,-96.80" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(post("https://maps.app.goo.gl/abc123"));
    const body = await res.json();
    expect(body.lat).toBeCloseTo(32.78);
    expect(body.lng).toBeCloseTo(-96.8);
    expect(body.mapsUrl).toBe("https://maps.google.com/maps?q=32.78,-96.80");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops following when a redirect leaves the allowlist", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.example.com/" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(post("https://maps.app.goo.gl/abc123"));
    const body = await res.json();
    expect(body.mapsUrl).toBe("https://maps.app.goo.gl/abc123");
    expect(body.lat).toBeNull();
  });

  it("returns all-null on a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const res = await POST(post("https://maps.app.goo.gl/abc123"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      name: null,
      lat: null,
      lng: null,
      mapsUrl: "https://maps.app.goo.gl/abc123",
    });
  });
});
