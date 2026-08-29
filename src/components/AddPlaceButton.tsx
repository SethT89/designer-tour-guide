import Link from "next/link";

/** Floating entry point to the public submission form, over the map. */
export function AddPlaceButton() {
  return (
    <Link
      href="/submit"
      className="label absolute bottom-4 right-4 z-10 border border-ink bg-paper px-3 py-2 !text-ink shadow-sm hover:bg-ink hover:!text-paper"
    >
      ＋ Add a place
    </Link>
  );
}
