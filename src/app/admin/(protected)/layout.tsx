import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b border-rule px-4 py-3">
        <nav className="flex gap-4">
          <Link href="/admin" className="label !text-ink">
            Queue
          </Link>
          <Link href="/admin/published" className="label">
            Published
          </Link>
          <Link href="/admin/new" className="label">
            Add place
          </Link>
        </nav>
        <form action="/auth/signout" method="post">
          <button className="label !text-muted">Sign out</button>
        </form>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
