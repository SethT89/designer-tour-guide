"use client";

import { useState } from "react";
import { createBrowserAuthClient } from "@/lib/supabase/auth-browser";
import { siteUrl } from "@/lib/env";

type Status = "idle" | "sending" | "sent" | "error";

export function LoginForm({ initialError = false }: { initialError?: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>(initialError ? "error" : "idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createBrowserAuthClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
    });
    setStatus(error ? "error" : "sent");
  }

  if (status === "sent") {
    return (
      <p className="leading-relaxed text-muted">
        Check your email for a sign-in link.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="label block">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-rule bg-paper px-3 py-2 outline-none focus:border-ink"
        />
      </div>
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full bg-ink px-4 py-2 font-sans text-paper disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : "Send magic link"}
      </button>
      {status === "error" && (
        <p className="label !text-accent">Something went wrong. Try again.</p>
      )}
    </form>
  );
}
