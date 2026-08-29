import type { Metadata } from "next";
import Link from "next/link";
import { PublicPlaceForm } from "./PublicPlaceForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Suggest a place — Designer Map",
  description: "Submit a design-worthy place for a curator to review.",
};

export default function SubmitPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <p className="label">Contribute</p>
      <h1 className="mt-2 font-display text-3xl leading-[1.1] tracking-[-0.015em] sm:text-4xl">
        Suggest a place
      </h1>
      <p className="mt-3 leading-relaxed text-muted">
        Tell us about a building, interior, shop, or piece of public design worth
        a detour. A curator reviews every submission before it appears on the
        map.
      </p>

      <div className="mt-8">
        <PublicPlaceForm />
      </div>

      <Link href="/" className="label mt-8 inline-block !text-muted">
        ← Back to the map
      </Link>
    </main>
  );
}
