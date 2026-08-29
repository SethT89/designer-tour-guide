"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Browser-side auth client for `signInWithOtp` on the login page. */
export function createBrowserAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
