import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlaceList } from "./PlaceList";
import type { PlacePublic } from "@/lib/types";

const base: PlacePublic = {
  id: "1",
  name: "Nasher",
  slug: "nasher",
  description: "",
  why: "",
  category: "museum_gallery",
  tags: [],
  lng: -96.8,
  lat: 32.8,
  address: "2001 Flora St",
  city: "Dallas",
  country: "USA",
  external_url: null,
  published_at: null,
  photos: [],
};

const shop: PlacePublic = { ...base, id: "2", slug: "b", name: "B", category: "shop" };

describe("PlaceList", () => {
  it("shows all places when no category is selected", () => {
    render(<PlaceList places={[base, shop]} category={null} />);
    expect(screen.getByText("Nasher")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("filters by category", () => {
    render(<PlaceList places={[base, shop]} category="shop" />);
    expect(screen.queryByText("Nasher")).not.toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", () => {
    render(<PlaceList places={[base]} category="shop" />);
    expect(screen.getByText(/no places/i)).toBeInTheDocument();
  });
});
