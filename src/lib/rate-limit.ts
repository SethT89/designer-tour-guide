import { getCloudflareContext } from "@opennextjs/cloudflare";

// Minimal shape of the bits of Workers KV we use — avoids depending on the
// `wrangler types` output (cloudflare-env.d.ts), which CI does not generate.
type KvLike = {
  get: (key: string) => Promise<string | null>;
  put: (
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ) => Promise<void>;
};

/**
 * Fixed-window rate limit backed by Workers KV. Fails open when the binding is
 * absent (local dev), so it never blocks development.
 */
export async function checkRateLimit(
  key: string,
  { limit, windowSec }: { limit: number; windowSec: number },
): Promise<{ allowed: boolean }> {
  let kv: KvLike | undefined;
  try {
    const env = getCloudflareContext().env as Record<string, unknown>;
    kv = env.RATE_LIMIT as KvLike | undefined;
  } catch {
    kv = undefined;
  }
  if (!kv) return { allowed: true };

  const k = `rl:${key}`;
  const current = Number((await kv.get(k)) ?? "0");
  if (current >= limit) return { allowed: false };
  await kv.put(k, String(current + 1), { expirationTtl: windowSec });
  return { allowed: true };
}
