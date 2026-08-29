import { describe, it, expect, vi, beforeEach } from "vitest";

const { getCloudflareContext } = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
}));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext }));

import { checkRateLimit } from "./rate-limit";

function fakeKv() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => void store.set(k, v)),
  };
}

beforeEach(() => getCloudflareContext.mockReset());

describe("checkRateLimit", () => {
  it("allows up to the limit then blocks", async () => {
    getCloudflareContext.mockReturnValue({ env: { RATE_LIMIT: fakeKv() } });

    const opts = { limit: 3, windowSec: 60 };
    expect((await checkRateLimit("1.2.3.4", opts)).allowed).toBe(true);
    expect((await checkRateLimit("1.2.3.4", opts)).allowed).toBe(true);
    expect((await checkRateLimit("1.2.3.4", opts)).allowed).toBe(true);
    expect((await checkRateLimit("1.2.3.4", opts)).allowed).toBe(false);
  });

  it("tracks keys independently", async () => {
    getCloudflareContext.mockReturnValue({ env: { RATE_LIMIT: fakeKv() } });
    const opts = { limit: 1, windowSec: 60 };
    expect((await checkRateLimit("a", opts)).allowed).toBe(true);
    expect((await checkRateLimit("b", opts)).allowed).toBe(true);
    expect((await checkRateLimit("a", opts)).allowed).toBe(false);
  });

  it("fails open when the KV binding is missing", async () => {
    getCloudflareContext.mockReturnValue({ env: {} });
    expect(
      (await checkRateLimit("x", { limit: 1, windowSec: 60 })).allowed,
    ).toBe(true);
  });
});
