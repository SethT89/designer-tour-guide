import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="label">404</p>
      <h1 className="mt-2 font-display text-3xl">Place not found</h1>
      <p className="mt-2 text-muted">This place may not be published yet.</p>
      <Link
        href="/"
        className="label mt-6 !text-accent underline decoration-1 underline-offset-4"
      >
        ← Back to the map
      </Link>
    </main>
  );
}
