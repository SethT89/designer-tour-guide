import { describe, it, expect } from "vitest";
import { parseGoogleMapsUrl } from "./google-maps-url";

describe("parseGoogleMapsUrl", () => {
  it("reads name and the precise !3d!4d coords from a place URL", () => {
    const r = parseGoogleMapsUrl(
      "https://www.google.com/maps/place/Nasher+Sculpture+Center/@32.7876813,-96.8022944,17z/data=!3m1!4b1!4m6!3m5!1s0x864e99:0x8f!8m2!3d32.7876813!4d-96.8001057!16s%2Fg%2F123",
    );
    expect(r.name).toBe("Nasher Sculpture Center");
    expect(r.lat).toBeCloseTo(32.7876813);
    expect(r.lng).toBeCloseTo(-96.8001057);
  });

  it("falls back to the @ viewport centre when there is no !3d!4d", () => {
    const r = parseGoogleMapsUrl(
      "https://www.google.com/maps/place/Perot+Museum/@32.7869,-96.8064,17z/",
    );
    expect(r.name).toBe("Perot Museum");
    expect(r.lat).toBeCloseTo(32.7869);
    expect(r.lng).toBeCloseTo(-96.8064);
  });

  it("percent-decodes the name", () => {
    const r = parseGoogleMapsUrl(
      "https://www.google.com/maps/place/Caf%C3%A9+Brazil/@32.8,-96.7,17z/",
    );
    expect(r.name).toBe("Café Brazil");
  });

  it("reads a q=lat,lng pin", () => {
    const r = parseGoogleMapsUrl("https://maps.google.com/?q=32.78,-96.80");
    expect(r.name).toBeNull();
    expect(r.lat).toBeCloseTo(32.78);
    expect(r.lng).toBeCloseTo(-96.8);
  });

  it("reads an ll=lat,lng pin and a q= name", () => {
    const r = parseGoogleMapsUrl(
      "https://maps.google.com/?q=Nasher+Sculpture+Center&ll=32.7876,-96.8001",
    );
    expect(r.name).toBe("Nasher Sculpture Center");
    expect(r.lat).toBeCloseTo(32.7876);
    expect(r.lng).toBeCloseTo(-96.8001);
  });

  it("rejects a Plus Code as a name", () => {
    const r = parseGoogleMapsUrl(
      "https://www.google.com/maps/place/QXW6%2B39+Dallas/@32.78,-96.8,17z/",
    );
    expect(r.name).toBeNull();
  });

  it("rejects out-of-range coordinates", () => {
    const r = parseGoogleMapsUrl(
      "https://www.google.com/maps/place/X/@999,-96.8,17z/",
    );
    expect(r.lat).toBeNull();
    expect(r.lng).toBeNull();
  });

  it("returns all-null for a non-maps URL", () => {
    const r = parseGoogleMapsUrl("https://example.com/");
    expect(r).toEqual({ name: null, lat: null, lng: null });
  });
});
