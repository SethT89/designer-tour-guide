import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMapConfig } from "./config";

const ENV_KEYS = [
  "NEXT_PUBLIC_MAP_CENTER_LNG",
  "NEXT_PUBLIC_MAP_CENTER_LAT",
  "NEXT_PUBLIC_MAP_ZOOM",
  "NEXT_PUBLIC_DEFAULT_CITY",
] as const;

// getMapConfig reads process.env on every call, so no module-cache juggling is
// needed — just save and restore the four keys around each test.
describe("getMapConfig", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("falls back to Dallas when env is unset", () => {
    const c = getMapConfig();
    expect(c.center).toEqual([-96.797, 32.7767]);
    expect(c.zoom).toBe(11);
    expect(c.city).toBe("Dallas");
  });

  it("reads values from env", () => {
    process.env.NEXT_PUBLIC_MAP_CENTER_LNG = "2.3522";
    process.env.NEXT_PUBLIC_MAP_CENTER_LAT = "48.8566";
    process.env.NEXT_PUBLIC_MAP_ZOOM = "13";
    process.env.NEXT_PUBLIC_DEFAULT_CITY = "Paris";
    const c = getMapConfig();
    expect(c.center).toEqual([2.3522, 48.8566]);
    expect(c.zoom).toBe(13);
    expect(c.city).toBe("Paris");
  });
});
