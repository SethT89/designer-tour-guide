import { NextResponse } from "next/server";
import { parseGoogleMapsUrl } from "@/lib/google-maps-url";

// Full Maps URLs are parsed directly; only these hosts are followed as redirects.
const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "g.co"]);
const ALLOWED_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "maps.google.com",
  ...SHORT_HOSTS,
]);

const MAX_HOPS = 5;

function host(raw: string): string | null {
  try {
    return new URL(raw).host;
  } catch {
    return null;
  }
}

function hostAllowed(raw: string): boolean {
  const h = host(raw);
  return h !== null && ALLOWED_HOSTS.has(h);
}

/**
 * Follow Location headers for short-link hosts until a real Google Maps URL is
 * reached. Every hop must stay on an allowlisted host or resolution stops.
 */
async function resolve(url: string): Promise<string> {
  let current = url;
  for (let i = 0; i < MAX_HOPS; i++) {
    const h = host(current);
    if (h === null || !SHORT_HOSTS.has(h)) return current;
    const res = await fetch(current, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    if (res.status < 300 || res.status >= 400) return current;
    const location = res.headers.get("location");
    if (!location) return current;
    const next = new URL(location, current).toString();
    if (!hostAllowed(next)) return current;
    current = next;
  }
  return current;
}

export async function POST(request: Request) {
  let url: string;
  try {
    url = String((await request.json()).url ?? "").trim();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!hostAllowed(url)) {
    return NextResponse.json(
      { error: "Paste a Google Maps link." },
      { status: 400 },
    );
  }

  let mapsUrl: string;
  try {
    mapsUrl = await resolve(url);
  } catch {
    return NextResponse.json({ name: null, lat: null, lng: null, mapsUrl: url });
  }

  const { name, lat, lng } = parseGoogleMapsUrl(mapsUrl);
  return NextResponse.json({ name, lat, lng, mapsUrl });
}
