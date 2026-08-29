import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { adminEmail } from "@/lib/env";

function url() {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return v;
}
function anon() {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!v) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return v;
}

/** Cookie-backed client for server components / route handlers / actions. */
export async function createAuthClient() {
  const store = await cookies();
  return createServerClient(url(), anon(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — the proxy refreshes cookies instead.
        }
      },
    },
  });
}

/** The signed-in user iff their email is the configured admin, else null. */
export async function getAdminUser() {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return user.email.toLowerCase() === adminEmail() ? user : null;
}
