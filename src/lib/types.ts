import type { PlaceCategory } from "./categories";

export type PlaceStatus = "pending" | "published" | "rejected";

export type PlacePhoto = {
  storage_path: string;
  credit: string | null;
  alt: string;
  sort_order: number;
};

/** A row from the `places_public` view — safe for the browser. */
export type PlacePublic = {
  id: string;
  name: string;
  slug: string;
  description: string;
  why: string;
  category: PlaceCategory;
  tags: string[];
  lng: number;
  lat: number;
  address: string;
  city: string;
  country: string;
  external_url: string | null;
  google_maps_url: string | null;
  published_at: string | null;
  photos: PlacePhoto[];
};
