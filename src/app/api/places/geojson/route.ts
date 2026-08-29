import { NextResponse } from "next/server";
import { getPublishedPlaces } from "@/lib/places";
import { placesToGeoJSON } from "@/lib/geojson";

export async function GET() {
  try {
    const places = await getPublishedPlaces();
    return NextResponse.json(placesToGeoJSON(places), {
      headers: {
        // Edge-cache for 5 min, serve stale for a day while revalidating.
        "cache-control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
