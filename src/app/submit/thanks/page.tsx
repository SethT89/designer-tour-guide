import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Thanks — Designer Map" };

export default function ThanksPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <p className="label">Submitted</p>
      <h1 className="mt-2 font-display text-3xl leading-[1.1] tracking-[-0.015em]">
        Thanks — a curator will review it.
      </h1>
      <p className="mt-3 leading-relaxed text-muted">
        If it fits the map, it&rsquo;ll show up soon. We may reach out if we have
        a question.
      </p>
      <Link href="/" className="label mt-8 inline-block !text-accent">
        ← Back to the map
      </Link>
    </main>
  );
}
