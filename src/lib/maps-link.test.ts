import { describe, it, expect } from "vitest";
import { openInMapsUrl } from "./maps-link";

describe("openInMapsUrl", () => {
  it("builds a geo query from name + coords", () => {
    expect(
      openInMapsUrl({
        name: "Nasher Sculpture Center",
        lat: 32.788,
        lng: -96.7986,
      }),
    ).toBe(
      "https://www.google.com/maps/search/?api=1&query=32.788%2C-96.7986%20Nasher%20Sculpture%20Center",
    );
  });
});
