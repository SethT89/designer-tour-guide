import { describe, it, expect } from "vitest";
import { parsePlaceInput, slugify } from "./place-input";

const ok = {
  name: "  Nasher Sculpture Center ",
  category: "museum_gallery",
  tags: "renzo piano, garden ,,garden",
  description: "d",
  why: "w",
  address: "2001 Flora St",
  lat: "32.788",
  lng: "-96.7986",
  external_url: "nasher.org",
};

describe("parsePlaceInput", () => {
  it("normalises a good payload", () => {
    const r = parsePlaceInput(ok);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.name).toBe("Nasher Sculpture Center");
    expect(r.value.tags).toEqual(["renzo piano", "garden"]);
    expect(r.value.slug).toBe("nasher-sculpture-center");
    expect(r.value.external_url).toBe("https://nasher.org");
    expect(r.value.lat).toBeCloseTo(32.788);
  });

  it("rejects a missing name", () => {
    const r = parsePlaceInput({ ...ok, name: "  " });
    expect(r.ok).toBe(false);
  });

  it("rejects out-of-range coordinates", () => {
    const r = parsePlaceInput({ ...ok, lat: "999" });
    expect(r.ok).toBe(false);
  });

  it("rejects an unknown category", () => {
    const r = parsePlaceInput({ ...ok, category: "nope" });
    expect(r.ok).toBe(false);
  });

  it("keeps a full URL untouched and allows an empty one", () => {
    const withUrl = parsePlaceInput({ ...ok, external_url: "https://x.org/a" });
    expect(withUrl.ok && withUrl.value.external_url).toBe("https://x.org/a");
    const noUrl = parsePlaceInput({ ...ok, external_url: "" });
    expect(noUrl.ok && noUrl.value.external_url).toBeNull();
  });

  it("caps tags at 12", () => {
    const many = Array.from({ length: 20 }, (_, i) => `t${i}`).join(",");
    const r = parsePlaceInput({ ...ok, tags: many });
    expect(r.ok && r.value.tags).toHaveLength(12);
  });
});

describe("slugify", () => {
  it("kebab-cases a name", () => {
    expect(slugify("Nasher Sculpture Center")).toBe("nasher-sculpture-center");
    expect(slugify("  Foo & Bar!  ")).toBe("foo-bar");
  });
});
