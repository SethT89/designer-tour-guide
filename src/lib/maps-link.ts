export function openInMapsUrl({
  name,
  lat,
  lng,
}: {
  name: string;
  lat: number;
  lng: number;
}): string {
  const query = encodeURIComponent(`${lat},${lng} ${name}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
