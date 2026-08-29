export type ParsedMapsUrl = {
  name: string | null;
  lat: number | null;
  lng: number | null;
};

const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}/i;

/** A lat/lng pair is only usable if both halves are in range. */
function coordPair(
  latRaw: number,
  lngRaw: number,
): { lat: number; lng: number } | null {
  const inRange = (n: number, min: number, max: number) =>
    Number.isFinite(n) && n >= min && n <= max;
  return inRange(latRaw, -90, 90) && inRange(lngRaw, -180, 180)
    ? { lat: latRaw, lng: lngRaw }
    : null;
}

function cleanName(raw: string | undefined): string | null {
  if (!raw) return null;
  let name: string;
  try {
    name = decodeURIComponent(raw.replace(/\+/g, " ")).trim();
  } catch {
    return null;
  }
  if (!name) return null;
  if (PLUS_CODE.test(name)) return null;
  // A bare "lat,lng" dropped-pin segment is not a name.
  if (/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(name)) return null;
  return name;
}

export function parseGoogleMapsUrl(url: string): ParsedMapsUrl {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { name: null, lat: null, lng: null };
  }

  let name: string | null = null;
  let pin: { lat: number; lng: number } | null = null;

  // /maps/place/<Name>/...
  const placeMatch = u.pathname.match(/\/maps\/place\/([^/]+)/);
  if (placeMatch) name = cleanName(placeMatch[1]);

  // Precise place location: ...!3d<lat>!4d<lng>...
  const d = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (d) pin = coordPair(parseFloat(d[1]), parseFloat(d[2]));

  // Viewport centre: @<lat>,<lng>,<zoom>z
  if (!pin) {
    const at = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (at) pin = coordPair(parseFloat(at[1]), parseFloat(at[2]));
  }

  // ?q= / ?ll= / &ll=
  const q = u.searchParams.get("q");
  const ll = u.searchParams.get("ll");
  const numPair = (s: string | null): [number, number] | null =>
    s && /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(s.trim())
      ? (s.trim().split(",").map(Number) as [number, number])
      : null;

  if (!pin) {
    const p = numPair(ll) ?? numPair(q);
    if (p) pin = coordPair(p[0], p[1]);
  }
  if (!name && q && !numPair(q)) name = cleanName(q);

  return { name, lat: pin?.lat ?? null, lng: pin?.lng ?? null };
}
