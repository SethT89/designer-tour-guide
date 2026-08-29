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
        housenumber: "2001",
        street: "Flora Street",
        city: "Dallas",
        state: "Texas",
      },
    },
  ],
};

function calledUrl(fetchMock: ReturnType<typeof vi.fn>) {
  return new URL(fetchMock.mock.calls[0][0] as string);
}

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/geocode", () => {
  it("proxies to Photon, biases toward Dallas, and includes the house number", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(photonFC), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(req("/api/geocode?q=nasher"));
    expect(res.status).toBe(200);
    const body = await res.json();

    const url = calledUrl(fetchMock);
    expect(url.origin + url.pathname).toBe("https://photon.komoot.io/api/");
    expect(url.searchParams.get("q")).toBe("nasher");
    expect(Number(url.searchParams.get("lat"))).toBeCloseTo(32.7767);
    expect(Number(url.searchParams.get("lon"))).toBeCloseTo(-96.797);

    expect(body.results).toEqual([
      {
        lat: 32.788,
        lng: -96.7986,
        label: "Nasher Sculpture Center, 2001 Flora Street, Dallas, Texas",
      },
    ]);
  });

  it("biases toward an explicit lat/lon when given", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(photonFC), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await GET(req("/api/geocode?q=x&lat=40.7&lon=-74"));
    const url = calledUrl(fetchMock);
    expect(url.searchParams.get("lat")).toBe("40.7");
    expect(url.searchParams.get("lon")).toBe("-74");
  });

  it("does not repeat the street as the label lead", async () => {
    const fc = {
      features: [
        {
          geometry: { coordinates: [-96.8, 32.78] },
          properties: { street: "Main Street", city: "Dallas", state: "Texas" },
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(fc), { status: 200 })),
    );
    const res = await GET(req("/api/geocode?q=main"));
    const body = await res.json();
    expect(body.results[0].label).toBe("Main Street, Dallas, Texas");
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
