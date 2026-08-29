import { describe, it, expect, vi, afterEach } from "vitest";
import { GET } from "./route";

function req(url: string) {
  return new Request(`http://localhost${url}`);
}

const photonFC = {
  features: [
    {
      geometry: { coordinates: [-96.7986, 32.788] },
      properties: {
        name: "Nasher Sculpture Center",
        street: "Flora Street",
        city: "Dallas",
        state: "Texas",
      },
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/geocode", () => {
  it("proxies to Photon and maps the results", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(photonFC), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(req("/api/geocode?q=nasher"));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://photon.komoot.io/api/?q=nasher&limit=5",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(body.results).toEqual([
      {
        lat: 32.788,
        lng: -96.7986,
        label: "Nasher Sculpture Center, Flora Street, Dallas, Texas",
      },
    ]);
  });

  it("400s on an empty query", async () => {
    const res = await GET(req("/api/geocode?q="));
    expect(res.status).toBe(400);
  });

  it("502s when Photon fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 500 })),
    );
    const res = await GET(req("/api/geocode?q=nasher"));
    expect(res.status).toBe(502);
  });
});
