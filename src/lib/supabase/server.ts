import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the anon key. RLS applies, so this only ever
 * sees `published` rows via the `places_public` view — the default for all
 * public reads. Use `admin.ts` only for the review dashboard (Phase 2).
 */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
