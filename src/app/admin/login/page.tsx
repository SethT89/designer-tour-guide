import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in — Designer Map" };

type Search = { searchParams: Promise<{ error?: string }> };

export default async function AdminLoginPage({ searchParams }: Search) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="font-display text-3xl leading-[1.1] tracking-[-0.015em]">
        Curator sign-in
      </h1>
      <p className="label mt-2 mb-8">Designer Map admin</p>
      <LoginForm initialError={error === "1"} />
    </main>
  );
}
