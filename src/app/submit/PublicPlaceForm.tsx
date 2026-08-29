"use client";

import { PlaceForm, type PlaceFormResult } from "@/components/PlaceForm";

async function submit(fd: FormData): Promise<PlaceFormResult> {
  try {
    const res = await fetch("/api/submit", { method: "POST", body: fd });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: body.error ?? "Submission failed." };
  } catch {
    return { ok: false, error: "Submission failed. Check your connection." };
  }
}

export function PublicPlaceForm() {
  return <PlaceForm mode="public" action={submit} />;
}
