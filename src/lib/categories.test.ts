import { describe, it, expect } from "vitest";
import { PLACE_CATEGORIES, categoryLabel } from "./categories";

describe("categories", () => {
  it("lists the eight MVP categories in a stable order", () => {
    expect(PLACE_CATEGORIES).toEqual([
      "architecture",
      "interiors",
      "graphic_signage",
      "product_furniture",
      "public_art",
      "museum_gallery",
      "shop",
      "other",
    ]);
  });

  it("maps a value to a display label", () => {
    expect(categoryLabel("graphic_signage")).toBe("Graphic / Signage");
    expect(categoryLabel("museum_gallery")).toBe("Museum / Gallery");
    expect(categoryLabel("other")).toBe("Other");
  });

  it("falls back to the raw value for an unknown category", () => {
    // @ts-expect-error deliberately invalid
    expect(categoryLabel("nope")).toBe("nope");
  });
});
