import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`,
      {
        headers: {
          "User-Agent": "designer-map (github.com/SethT89/designer-tour-guide)",
        },
      },
    );
    if (!res.ok) throw new Error(String(res.status));
    const fc = (await res.json()) as {
      features: {
        geometry: { coordinates: [number, number] };
        properties: Record<string, string>;
      }[];
    };
    const results = fc.features.map((f) => ({
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      label: [
        f.properties.name,
        f.properties.street,
        f.properties.city,
        f.properties.state,
      ]
        .filter(Boolean)
        .join(", "),
    }));
    return NextResponse.json(
      { results },
      { headers: { "cache-control": "public, s-maxage=86400" } },
    );
  } catch {
    return NextResponse.json({ error: "geocoder unavailable" }, { status: 502 });
  }
}
