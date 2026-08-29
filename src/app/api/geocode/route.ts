import { NextResponse } from "next/server";
import { getMapConfig } from "@/lib/config";

type PhotonProps = {
  name?: string;
  housenumber?: string;
  street?: string;
  city?: string;
  state?: string;
};

/** Human label that echoes what people type: "<name>, <number> <street>, <city>, <state>". */
function toLabel(p: PhotonProps): string {
  const streetLine = [p.housenumber, p.street].filter(Boolean).join(" ");
  const lead =
    p.name && p.name !== p.street && p.name !== streetLine ? p.name : undefined;
  return [lead, streetLine || p.street, p.city, p.state]
    .filter(Boolean)
    .join(", ");
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });

  // Bias results toward the caller's location, falling back to the map's
  // configured centre (Dallas) — Photon otherwise ranks globally and a plain
  // street address can resolve to the wrong city.
  const [centerLng, centerLat] = getMapConfig().center;
  const lat = Number(params.get("lat") ?? centerLat);
  const lon = Number(params.get("lon") ?? centerLng);

  const photon = new URL("https://photon.komoot.io/api/");
  photon.searchParams.set("q", q);
  photon.searchParams.set("limit", "6");
  photon.searchParams.set("lang", "en");
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    photon.searchParams.set("lat", String(lat));
    photon.searchParams.set("lon", String(lon));
  }

  try {
    const res = await fetch(photon.toString(), {
      headers: {
        "User-Agent": "designer-map (github.com/SethT89/designer-tour-guide)",
      },
    });
    if (!res.ok) throw new Error(String(res.status));
    const fc = (await res.json()) as {
      features: {
        geometry: { coordinates: [number, number] };
        properties: PhotonProps;
      }[];
    };
    const results = fc.features.map((f) => ({
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      label: toLabel(f.properties),
    }));
    return NextResponse.json(
      { results },
      { headers: { "cache-control": "public, s-maxage=86400" } },
    );
  } catch {
    return NextResponse.json({ error: "geocoder unavailable" }, { status: 502 });
  }
}
