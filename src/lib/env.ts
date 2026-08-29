/** The one email address allowed into /admin. Lower-cased for comparison. */
export function adminEmail(): string {
  const v = process.env.ADMIN_EMAIL;
  if (!v) throw new Error("Missing ADMIN_EMAIL");
  return v.toLowerCase();
}

/** Base URL for magic-link redirects. Falls back to localhost in dev. */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
