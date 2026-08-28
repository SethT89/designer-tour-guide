export type MapConfig = {
  center: [number, number];
  zoom: number;
  city: string;
  styleUrl: string;
};

const DALLAS: Omit<MapConfig, "styleUrl"> = {
  center: [-96.797, 32.7767],
  zoom: 11,
  city: "Dallas",
};

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getMapConfig(): MapConfig {
  return {
    center: [
      num(process.env.NEXT_PUBLIC_MAP_CENTER_LNG, DALLAS.center[0]),
      num(process.env.NEXT_PUBLIC_MAP_CENTER_LAT, DALLAS.center[1]),
    ],
    zoom: num(process.env.NEXT_PUBLIC_MAP_ZOOM, DALLAS.zoom),
    city: process.env.NEXT_PUBLIC_DEFAULT_CITY || DALLAS.city,
    styleUrl: "https://tiles.openfreemap.org/styles/liberty",
  };
}
