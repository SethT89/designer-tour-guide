# Phase 2 — Write Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Load `frontend-design:frontend-design` before building any form/admin UI** and follow the established field-guide aesthetic (below).

**Goal:** A place can be submitted by the public through a form and published by the curator through a protected admin dashboard — entirely in the browser, no SQL.

**Architecture:** Supabase magic-link auth gives the single admin a cookie session (`@supabase/ssr`); `middleware.ts` gates `/admin/*` on `user.email === ADMIN_EMAIL`. Admin mutations run as server actions that re-check the session and write with the **service-role** client (`admin.ts`), which bypasses the Phase 1 base-table lockdown. Public submissions POST multipart to `/api/submit` — honeypot + KV fixed-window rate limit, client-resized photos uploaded to a public Supabase Storage bucket by the service-role client, a `pending` row inserted. A shared `PlaceForm` drives the public form, the admin "add directly" tool, and edit-then-publish. Geocoding is a Photon proxy at `/api/geocode`; a `PinPicker` mini-map lets the pin be nudged. Photo *display* is wired into the Phase 1 surfaces now that real photos exist.

**Tech Stack:** Next.js 16 (middleware, server actions, route handlers), `@supabase/ssr`, Supabase Auth + Storage, Cloudflare KV, MapLibre GL, Photon geocoder, Vitest.

---

## Context for the implementer

- **Read first:** the spec `docs/superpowers/specs/2026-08-28-designer-map-design.md`, and the Phase 0 + Phase 1 plans in `docs/superpowers/plans/` (execution notes cover every gotcha). The project memory file also summarises state.
- Live: `https://designer-tour-guide.sethmthomas89.workers.dev`. Supabase ref `hrovkahgsbiygaymeovu`. Cloudflare account `sethmthomas89@gmail.com`, Worker name `designer-tour-guide`.
- **Migrations:** committed `.sql` under `supabase/migrations/`, applied with `npx supabase db push` (project linked). **Every file starts with `set search_path = public, extensions;`**
- **Supabase clients:**
  - `src/lib/supabase/server.ts` — anon, RLS-scoped, public reads via `places_public` (Phase 1).
  - `src/lib/supabase/admin.ts` — service-role, bypasses RLS. All Phase 2 writes.
  - `src/lib/supabase/client.ts` — **unused, delete it in Task 1.**
  - This plan adds `src/lib/supabase/auth.ts` — `@supabase/ssr` cookie clients + `getAdminUser()`.
- **Existing gotchas that still apply:** full-regen `package-lock.json` (`rm -rf node_modules package-lock.json && npm install`) after adding deps, then commit it — incremental `npm install` breaks `npm ci` on Linux CI. `typecheck` is `next typegen && tsc --noEmit`. `server-only` is aliased to `src/test/empty.ts` in `vitest.config.mts`. Data-fetching pages need `export const dynamic = "force-dynamic"`. Pure logic lives in non-`server-only` modules so route tests can mock the IO layer. `preview`/`deploy` scripts run `node scripts/copy-maplibre-worker.mjs` first.
- Conventional Commits; every commit ends with:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```
- Full gate after each task: `npm run lint && npm run typecheck && npm run test:run && npm run build`.

## Aesthetic (established Phase 1 — keep it)

Field-guide: warm paper `#f6f3ec` / paper-dim `#efeae0`, ink `#191817`, muted `#6b655c`, one vermilion accent `#e8483c`, hairline `--color-rule`. Fonts: `font-display` (Fraunces) for names/headings, `font-sans` (Archivo) body, `.label` class (IBM Plex Mono, uppercase, tracked) for metadata and small controls. Tokens in `src/app/globals.css` `@theme`. Forms: hairline-ruled fields, mono labels, ink/paper buttons, vermilion for primary actions and links.

## New environment / infrastructure

| Name | Where | Notes |
|---|---|---|
| `ADMIN_EMAIL` | `.env.local` (dev) + `wrangler.jsonc` `vars` (prod) | The one allowed admin address. Not secret, not `NEXT_PUBLIC`. |
| `NEXT_PUBLIC_SITE_URL` | `.env` (committed) | `https://designer-tour-guide.sethmthomas89.workers.dev`; magic-link `emailRedirectTo`. Dev overrides to `http://localhost:3000` in `.env.local`. |
| `RATE_LIMIT` (KV) | `wrangler.jsonc` `kv_namespaces` | Created with `npx wrangler kv namespace create RATE_LIMIT`. |
| `place-photos` bucket | Supabase Storage (public) | Created in migration `0003`. |
| Supabase Auth URL config | **HUMAN STEP**, Supabase dashboard | Site URL + redirect allowlist (Task 2). |

## File structure (created / modified by this plan)

| Path | Responsibility |
|---|---|
| `src/lib/supabase/auth.ts` | `@supabase/ssr` cookie client (server); `getAdminUser()` |
| `src/lib/supabase/auth-browser.ts` | `"use client"` — `createBrowserAuthClient()` for `signInWithOtp` |
| `src/lib/env.ts` | typed access to `ADMIN_EMAIL`, `NEXT_PUBLIC_SITE_URL` |
| `middleware.ts` | refresh session cookies + gate `/admin/*` |
| `src/app/auth/callback/route.ts` | magic-link code exchange |
| `src/app/admin/login/page.tsx` | email → `signInWithOtp` |
| `src/app/admin/layout.tsx` | server guard + admin nav shell |
| `src/app/admin/page.tsx` | review queue (pending) |
| `src/app/admin/published/page.tsx` | published list + unpublish |
| `src/app/admin/new/page.tsx` | add place directly |
| `src/app/admin/[id]/edit/page.tsx` | edit-then-publish / edit published |
| `src/app/admin/actions.ts` | server actions: publish, reject, updatePlace, unpublish, createPlaceDirectly |
| `src/lib/admin/places.ts` | service-role reads: `getPlacesByStatus`, `getPlaceForAdmin` |
| `src/app/submit/page.tsx` | public submission form |
| `src/app/submit/thanks/page.tsx` | confirmation |
| `src/app/api/submit/route.ts` | public submission handler (honeypot, rate limit, insert `pending`) |
| `src/app/api/geocode/route.ts` | Photon proxy |
| `src/lib/rate-limit.ts` | KV fixed-window limiter |
| `src/lib/storage.ts` | `uploadPlacePhotos()`, `photoUrl()` |
| `src/lib/image-resize.ts` | client-side resize to ≤1600px WebP |
| `src/lib/place-input.ts` | zod-free validation + normalisation of place form fields; `slugify()` |
| `src/lib/slug.ts` | `shortId()` for slug uniqueness |
| `src/components/PlaceForm.tsx` | shared create/edit form |
| `src/components/PinPicker.tsx` | mini-map with a draggable marker |
| `src/components/PlacePhoto.tsx` | `next/image` wrapper for a stored photo |
| `src/components/AddPlaceButton.tsx` | floating "＋ Add a place" link on the home map |
| `src/app/place/[slug]/page.tsx` | **modify** — photo gallery when photos exist |
| `src/components/PlacePreviewSheet.tsx` | **modify** — hero photo when present |
| `src/components/PlaceCard.tsx` | **modify** — thumbnail when present |
| `src/lib/geojson.ts` | **modify** — add `thumb: string \| null` (first photo's storage_path) to feature properties |
| `next.config.ts` | **modify** — `images.remotePatterns` for Supabase storage |
| `wrangler.jsonc` | **modify** — `RATE_LIMIT` KV binding, `ADMIN_EMAIL` var |
| `.env` / `.env.local` / `.env.example` | **modify** — new vars |
| `supabase/migrations/0003_write_path.sql` | storage bucket + policy, `places_admin` view, queue index, `insert_place` + `set_place_point` RPCs |
| `src/lib/photo-url.ts` | client-safe `photoUrl(storage_path)` |

---

## Task 1: Auth foundation

**Files:** create `src/lib/supabase/auth.ts`, `src/lib/env.ts`; delete `src/lib/supabase/client.ts`; modify `.env`, `.env.local`, `.env.example`

- [ ] **Step 1: Install `@supabase/ssr`**

```bash
npm install @supabase/ssr
rm -rf node_modules package-lock.json && npm install
```
(The regen keeps `npm ci` working on Linux CI — see Phase 0 Task 4.)

- [ ] **Step 2: Add env vars**

`.env` (committed) — add:
```
NEXT_PUBLIC_SITE_URL=https://designer-tour-guide.sethmthomas89.workers.dev
```
`.env.local` (gitignored) — add:
```
ADMIN_EMAIL=sethmthomas89@gmail.com
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```
`.env.example` — document both (`ADMIN_EMAIL` under the secret-ish section, `NEXT_PUBLIC_SITE_URL` under public).

- [ ] **Step 3: Create `src/lib/env.ts`**

```typescript
export function adminEmail(): string {
  const v = process.env.ADMIN_EMAIL;
  if (!v) throw new Error("Missing ADMIN_EMAIL");
  return v.toLowerCase();
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
```

- [ ] **Step 4: Create `src/lib/supabase/auth.ts`**

```typescript
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
          // called from a Server Component — middleware refreshes instead
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
```

- [ ] **Step 5: Delete the unused client**

```bash
git rm src/lib/supabase/client.ts
```

- [ ] **Step 6: Gate + commit**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A
git commit -m "$(cat <<'EOF'
feat(auth): @supabase/ssr clients and getAdminUser gate

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 2: Magic-link login + callback

**Files:** create `src/app/admin/login/page.tsx`, `src/app/auth/callback/route.ts`

- [ ] **Step 1: HUMAN STEP — configure Supabase Auth URLs**

Ask the human: Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL:** `https://designer-tour-guide.sethmthomas89.workers.dev`
- **Redirect URLs — add:** `http://localhost:3000/**` and `https://designer-tour-guide.sethmthomas89.workers.dev/**`

Also **Authentication → Providers → Email:** confirm "Enable Email provider" is on and "Confirm email" / magic link is enabled (default). Note: free-tier Supabase throttles auth emails to a few per hour — fine for one admin.

- [ ] **Step 2: Callback route**

Create `src/app/auth/callback/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/auth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/admin";

  if (code) {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/admin/login?error=1`);
}
```

- [ ] **Step 3: Login page**

Create `src/app/admin/login/page.tsx` (`"use client"`): an email input + "Send magic link" button calling a browser `@supabase/ssr` client's `auth.signInWithOtp({ email, options: { emailRedirectTo: \`${siteUrl()}/auth/callback\` } })`. Show "Check your email" on success, "Something went wrong" on error or `?error=1`. Style per the aesthetic — centered, `font-display` heading, `.label` field label, ink button.

Use a browser client helper — add to `src/lib/supabase/auth.ts`:
```typescript
"use client";
import { createBrowserClient } from "@supabase/ssr";
export function createBrowserAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```
**Note:** a file can't mix `"use client"` and server-only `cookies()` imports. Put the browser helper in a separate `src/lib/supabase/auth-browser.ts` with `"use client"`.

- [ ] **Step 4: Manual check**

`npm run dev` → visit `/admin/login`, submit your email, confirm the email arrives and the link lands on `/admin` (which 404s until Task 4 — that's fine; the redirect target is what matters). Check `document.cookie` shows an `sb-` auth cookie after.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(auth): magic-link login page and callback route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `middleware.ts` — protect `/admin/*`

**Files:** create `middleware.ts`

- [ ] **Step 1: Write the middleware**

Create `middleware.ts` (repo root):
```typescript
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "").toLowerCase();

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const path = request.nextUrl.pathname;

  if (!isAdmin && path.startsWith("/admin") && path !== "/admin/login") {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  if (isAdmin && path === "/admin/login") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 2: Manual check**

`npm run dev` → hitting `/admin` while logged out redirects to `/admin/login`; after the magic-link login it lets you through (still 404 until Task 4). Log-out path is added in Task 4's nav.

- [ ] **Step 3: Gate + commit**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add middleware.ts
git commit -m "$(cat <<'EOF'
feat(auth): middleware gating /admin on the admin email

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 4: Admin shell

**Files:** create `src/app/admin/layout.tsx`, `src/app/admin/page.tsx` (placeholder)

- [ ] **Step 1: Layout with a second guard + nav**

Create `src/app/admin/layout.tsx` (server component):
```tsx
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
          <Link href="/admin" className="label !text-ink">Queue</Link>
          <Link href="/admin/published" className="label">Published</Link>
          <Link href="/admin/new" className="label">Add place</Link>
        </nav>
        <form action="/auth/signout" method="post">
          <button className="label !text-muted">Sign out</button>
        </form>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Sign-out route**

Create `src/app/auth/signout/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/auth";

export async function POST(request: Request) {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/admin/login", request.url), {
    status: 303,
  });
}
```

- [ ] **Step 3: Placeholder queue page**

Create `src/app/admin/page.tsx`:
```tsx
export const dynamic = "force-dynamic";
export default function AdminQueue() {
  return <p className="label">Review queue — built in Task 10.</p>;
}
```

- [ ] **Step 4: Manual check + commit**

`npm run dev` → log in → `/admin` shows the nav + placeholder; "Sign out" returns you to `/admin/login` and re-hitting `/admin` redirects. Then:
```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A
git commit -m "$(cat <<'EOF'
feat(admin): guarded admin shell with nav and sign-out

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 5: Migration `0003` — storage bucket, admin view, queue index, write RPCs

**Files:** create `supabase/migrations/0003_write_path.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0003_write_path.sql`:
```sql
set search_path = public, extensions;

-- Public bucket for place photos. 5 MB / image, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-photos', 'place-photos', true, 5242880,
        array['image/webp','image/jpeg','image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read place-photos" on storage.objects;
create policy "public read place-photos" on storage.objects
  for select using (bucket_id = 'place-photos');
-- inserts/updates/deletes: none for anon/authenticated; the service-role client
-- bypasses RLS.

-- Admin read model: every column + flattened coords, no status filter.
drop view if exists places_admin;
create view places_admin as
select
  p.*,
  st_x(p.location::geometry) as lng,
  st_y(p.location::geometry) as lat
from places p;
revoke all on places_admin from anon, authenticated;

-- Review queue ordering.
create index if not exists places_status_created_idx
  on places (status, created_at desc);

-- Insert a place from JSON + coords (the JS client can't write a geography
-- literal). Used by /api/submit (status 'pending') and createPlaceDirectly
-- (status 'published'). SECURITY DEFINER; callers are already trusted
-- (rate-limited public route, or an admin-session server action).
create or replace function public.insert_place(
  p jsonb, p_lng double precision, p_lat double precision
) returns uuid language plpgsql security definer as $$
declare new_id uuid;
begin
  insert into places (
    name, slug, description, why, category, tags, address, city, country,
    external_url, status, submitter_email, submitter_note, published_at, location
  )
  values (
    p->>'name', p->>'slug', coalesce(p->>'description',''), coalesce(p->>'why',''),
    (p->>'category')::place_category,
    coalesce((select array_agg(x) from jsonb_array_elements_text(p->'tags') x), '{}'),
    coalesce(p->>'address',''), coalesce(p->>'city',''), coalesce(p->>'country',''),
    nullif(p->>'external_url',''), (p->>'status')::place_status,
    nullif(p->>'submitter_email',''), nullif(p->>'submitter_note',''),
    case when (p->>'published_at') is not null then now() else null end,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  )
  returning id into new_id;
  return new_id;
end $$;
revoke all on function public.insert_place(jsonb, double precision, double precision)
  from anon, authenticated;

-- Move an existing place's pin (used by updatePlace).
create or replace function public.set_place_point(
  p_id uuid, p_lng double precision, p_lat double precision
) returns void language sql security definer as $$
  update places set location = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  where id = p_id;
$$;
revoke all on function public.set_place_point(uuid, double precision, double precision)
  from anon, authenticated;
```

- [ ] **Step 2: Apply + verify**

```bash
npx supabase db push
```
Then verify the bucket and that anon still cannot read it directly:
```bash
KEY=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env | cut -d= -f2-)
curl -s "https://hrovkahgsbiygaymeovu.supabase.co/storage/v1/bucket/place-photos" -H "apikey: $KEY" | python3 -m json.tool
```
Expected: a JSON object with `"public": true`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_write_path.sql
git commit -m "$(cat <<'EOF'
feat(db): place-photos bucket, places_admin view, queue index

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 6: Storage + admin data-layer helpers

**Files:** create `src/lib/storage.ts`, `src/lib/admin/places.ts`, `src/lib/admin/places.test.ts`; modify `next.config.ts`

- [ ] **Step 1: `src/lib/photo-url.ts` (client-safe)**

```typescript
const BUCKET = "place-photos";

export function photoUrl(storagePath: string): string {
  if (/^https?:\/\//.test(storagePath)) return storagePath;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}
```

- [ ] **Step 2: `next.config.ts` remote images**

```typescript
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "hrovkahgsbiygaymeovu.supabase.co",
        pathname: "/storage/v1/object/public/place-photos/**",
      },
    ],
  },
};
```

- [ ] **Step 3: `src/lib/storage.ts`**

```typescript
import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "./supabase/admin";

const BUCKET = "place-photos";

/** Uploads already-resized image blobs; returns their storage paths. */
export async function uploadPlacePhotos(
  placeId: string,
  files: File[],
): Promise<string[]> {
  const supabase = createAdminClient();
  const paths: string[] = [];
  for (const file of files.slice(0, 5)) {
    const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
    const path = `${placeId}/${randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(`photo upload failed: ${error.message}`);
    paths.push(path);
  }
  return paths;
}
```

- [ ] **Step 4: `src/lib/admin/places.ts`**

```typescript
import "server-only";
import { createAdminClient } from "../supabase/admin";
import type { PlaceStatus } from "../types";

const COLUMNS =
  "id,name,slug,description,why,category,tags,lng,lat,address,city,country,external_url,status,submitter_email,submitter_note,rejection_reason,created_at,published_at";

export type AdminPlace = {
  id: string;
  name: string;
  slug: string;
  description: string;
  why: string;
  category: string;
  tags: string[];
  lng: number;
  lat: number;
  address: string;
  city: string;
  country: string;
  external_url: string | null;
  status: PlaceStatus;
  submitter_email: string | null;
  submitter_note: string | null;
  rejection_reason: string | null;
  created_at: string;
  published_at: string | null;
  photos: { id: string; storage_path: string; alt: string; sort_order: number }[];
};

export async function getPlacesByStatus(status: PlaceStatus): Promise<AdminPlace[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("places_admin")
    .select(COLUMNS)
    .eq("status", status)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<AdminPlace, "photos">[];
  return attachPhotos(supabase, rows);
}

export async function getPlaceForAdmin(id: string): Promise<AdminPlace | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("places_admin")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [withPhotos] = await attachPhotos(supabase, [data as Omit<AdminPlace, "photos">]);
  return withPhotos;
}

async function attachPhotos(
  supabase: ReturnType<typeof createAdminClient>,
  rows: Omit<AdminPlace, "photos">[],
): Promise<AdminPlace[]> {
  if (rows.length === 0) return [];
  const { data } = await supabase
    .from("place_photos")
    .select("id,place_id,storage_path,alt,sort_order")
    .in(
      "place_id",
      rows.map((r) => r.id),
    )
    .order("sort_order");
  const byPlace = new Map<string, AdminPlace["photos"]>();
  for (const p of data ?? []) {
    const list = byPlace.get(p.place_id) ?? [];
    list.push({ id: p.id, storage_path: p.storage_path, alt: p.alt, sort_order: p.sort_order });
    byPlace.set(p.place_id, list);
  }
  return rows.map((r) => ({ ...r, photos: byPlace.get(r.id) ?? [] }));
}
```

- [ ] **Step 5: Test the query shapes**

Create `src/lib/admin/places.test.ts` — mock `../supabase/admin`, assert `getPlacesByStatus("pending")` queries `places_admin`, filters `status`, orders `created_at` desc, and merges `place_photos` by `place_id`. (Mirror the mock-chain style of `src/lib/places.test.ts`.)

- [ ] **Step 6: Gate + commit**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A
git commit -m "$(cat <<'EOF'
feat: storage upload helper and admin places data layer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 7: Place-input validation + client image resize

**Files:** create `src/lib/place-input.ts`, `src/lib/place-input.test.ts`, `src/lib/image-resize.ts`, `src/lib/image-resize.test.ts`

- [ ] **Step 1: `place-input.ts` — TDD**

Write `src/lib/place-input.test.ts` first:
```typescript
import { describe, it, expect } from "vitest";
import { parsePlaceInput } from "./place-input";

const ok = {
  name: "  Nasher Sculpture Center ",
  category: "museum_gallery",
  tags: "renzo piano, garden ,,garden",
  description: "d",
  why: "w",
  address: "2001 Flora St",
  lat: "32.788",
  lng: "-96.7986",
  external_url: "nasher.org",
};

describe("parsePlaceInput", () => {
  it("normalises a good payload", () => {
    const r = parsePlaceInput(ok);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.name).toBe("Nasher Sculpture Center");
    expect(r.value.tags).toEqual(["renzo piano", "garden"]);
    expect(r.value.slug).toBe("nasher-sculpture-center");
    expect(r.value.external_url).toBe("https://nasher.org");
    expect(r.value.lat).toBeCloseTo(32.788);
  });

  it("rejects a missing name", () => {
    const r = parsePlaceInput({ ...ok, name: "  " });
    expect(r.ok).toBe(false);
  });

  it("rejects out-of-range coordinates", () => {
    const r = parsePlaceInput({ ...ok, lat: "999" });
    expect(r.ok).toBe(false);
  });

  it("rejects an unknown category", () => {
    const r = parsePlaceInput({ ...ok, category: "nope" });
    expect(r.ok).toBe(false);
  });
});
```

Then implement `src/lib/place-input.ts`: a `parsePlaceInput(raw: Record<string,string>)` returning `{ ok: true, value: {...} } | { ok: false, errors: Record<string,string> }`. Rules: `name` required (trim, 1–200); `category` must be in `PLACE_CATEGORIES`; `tags` split on `,`, trim, drop empties, dedupe, cap 12; `description`/`why` trimmed, ≤ 2000; `address` trimmed; `lat` ∈ [-90,90], `lng` ∈ [-180,180]; `external_url` optional, prepend `https://` if no scheme, must parse as URL; `slug` = kebab of name + (caller appends a short id on insert to guarantee uniqueness — see Task 9). Export a `slugify(name)` helper too.

- [ ] **Step 2: `image-resize.ts` — TDD (jsdom + canvas mock)**

Write `src/lib/image-resize.test.ts` mocking `createImageBitmap` and `OffsetCanvas`/`document.createElement("canvas")` to assert: an image wider than 1600px is scaled so its longest edge is 1600, aspect ratio preserved, output MIME is `image/webp`, and a file already smaller is returned near-unchanged. Then implement `resizeImage(file: File, maxEdge = 1600): Promise<File>` using `createImageBitmap` + a canvas `toBlob("image/webp", 0.85)`, returning a new `File` with a `.webp` name. Guard for non-image input (throw).

- [ ] **Step 3: Run both test files, then gate + commit**

```bash
npm run test:run -- src/lib/place-input.test.ts src/lib/image-resize.test.ts
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A
git commit -m "$(cat <<'EOF'
feat: place-input validation and client image resize

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 8: `PinPicker` + `PlaceForm` + `/api/geocode`

**Files:** create `src/components/PinPicker.tsx`, `src/components/PinPicker.test.tsx`, `src/components/PlaceForm.tsx`, `src/app/api/geocode/route.ts`, `src/app/api/geocode/route.test.ts`

- [ ] **Step 1: `/api/geocode` — Photon proxy, TDD**

`src/app/api/geocode/route.test.ts`: mock `fetch`, assert `GET /api/geocode?q=nasher` calls `https://photon.komoot.io/api/?q=nasher&limit=5` and maps the Photon FeatureCollection to `[{ label, lat, lng }]`; empty `q` → 400; upstream failure → 502.

`src/app/api/geocode/route.ts`:
```typescript
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`,
      { headers: { "User-Agent": "designer-map (github.com/SethT89/designer-tour-guide)" } },
    );
    if (!res.ok) throw new Error(String(res.status));
    const fc = (await res.json()) as {
      features: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }[];
    };
    const results = fc.features.map((f) => ({
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      label: [f.properties.name, f.properties.street, f.properties.city, f.properties.state]
        .filter(Boolean)
        .join(", "),
    }));
    return NextResponse.json(
      { results },
      { headers: { "cache-control": "public, s-maxage=86400" } },
    );
  } catch {
    return NextResponse.json({ error: "geocoder unavailable" }, { status: 502 });
  }
}
```

- [ ] **Step 2: `PinPicker.tsx`**

`"use client"` — props `{ value: { lat: number; lng: number } | null; onChange: (v: {lat:number;lng:number}) => void }`. A ~240px-tall MapLibre map (call `configureMapLibre()`), one `maplibregl.Marker({ draggable: true })`; on `dragend` call `onChange` with the marker's `getLngLat()`. When `value` changes from outside (geocode result) move the marker + `map.easeTo`. Falls back to the Dallas centre from `getMapConfig()` when `value` is null.

Test `PinPicker.test.tsx` (mock `maplibre-gl` like `MapView.test.tsx`): renders a container, constructs a draggable `Marker`, wires a `dragend` handler.

- [ ] **Step 3: `PlaceForm.tsx`**

`"use client"` — props:
```typescript
type Props = {
  mode: "public" | "admin-create" | "admin-edit";
  initial?: Partial<PlaceFormValues>;
  action: (form: FormData) => Promise<{ ok: boolean; error?: string; slug?: string }>;
};
```
Fields: name; address text + "Find on map" button (calls `/api/geocode`, shows a result list, picking one sets the pin); `<PinPicker>`; category `<select>`; tags text; description `<textarea>`; why `<textarea>`; photos `<input type="file" accept="image/*" multiple>` (on change: `resizeImage` each, cap 5, show previews + remove buttons); **public mode only:** optional email, optional "note to the curator", and a visually-hidden honeypot input named `company`. Submit button label varies by `mode`. On submit: build `FormData` (fields + `lat`/`lng` from the pin + resized photo blobs + honeypot), call `action`, then show `error` inline or navigate (`/submit/thanks` for public, `/admin` for admin edit/create).

Style: hairline-ruled fields, `.label` field labels, vermilion submit for public, ink submit for admin.

- [ ] **Step 4: Gate + commit**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A
git commit -m "$(cat <<'EOF'
feat: geocode proxy, PinPicker, and the shared PlaceForm

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 9: KV rate limit

**Files:** create `src/lib/rate-limit.ts`, `src/lib/rate-limit.test.ts`; modify `wrangler.jsonc`, `.dev.vars` (optional)

- [ ] **Step 1: Create the KV namespace**

```bash
npx wrangler kv namespace create RATE_LIMIT
```
Copy the `id` from the output.

- [ ] **Step 2: Bind it in `wrangler.jsonc`**

Add:
```jsonc
  "kv_namespaces": [
    { "binding": "RATE_LIMIT", "id": "<id-from-step-1>" }
  ],
```
Also add `ADMIN_EMAIL` to `vars` (plaintext — it's an allowlist, not a secret):
```jsonc
    "ADMIN_EMAIL": "sethmthomas89@gmail.com"
```

- [ ] **Step 3: `src/lib/rate-limit.ts` — TDD**

`src/lib/rate-limit.test.ts`: mock `@opennextjs/cloudflare`'s `getCloudflareContext` to return a fake KV (`get`/`put` over a `Map`); assert `checkRateLimit("1.2.3.4", { limit: 3, windowSec: 60 })` returns `{ allowed: true }` for the first 3 calls and `{ allowed: false }` on the 4th; a missing KV binding (dev) returns `{ allowed: true }` (fail-open).

```typescript
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function checkRateLimit(
  key: string,
  { limit, windowSec }: { limit: number; windowSec: number },
): Promise<{ allowed: boolean }> {
  let kv: KVNamespace | undefined;
  try {
    kv = getCloudflareContext().env.RATE_LIMIT as KVNamespace | undefined;
  } catch {
    kv = undefined;
  }
  if (!kv) return { allowed: true };

  const k = `rl:${key}`;
  const current = Number((await kv.get(k)) ?? "0");
  if (current >= limit) return { allowed: false };
  await kv.put(k, String(current + 1), { expirationTtl: windowSec });
  return { allowed: true };
}
```
(`cf-typegen` after wrangler changes gives `KVNamespace` typing: `npm run cf-typegen`.)

- [ ] **Step 4: Gate + commit**

```bash
npm run cf-typegen
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A
git commit -m "$(cat <<'EOF'
feat: KV fixed-window rate limiter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 10: Public submission — `/api/submit` + `/submit`

**Files:** create `src/app/api/submit/route.ts`, `src/app/api/submit/route.test.ts`, `src/app/submit/page.tsx`, `src/app/submit/thanks/page.tsx`, `src/components/AddPlaceButton.tsx`; modify `src/components/HomeView.tsx`

- [ ] **Step 1: `/api/submit` — TDD**

`src/app/api/submit/route.test.ts`: mock `@/lib/rate-limit`, `@/lib/storage`, `@/lib/supabase/admin`, `@/lib/place-input`. Assert:
- a filled honeypot (`company` non-empty) → `200 { ok: true }` but **no** DB insert (silent success),
- `checkRateLimit` returning `{ allowed: false }` → `429`,
- invalid input → `400` with the field errors,
- the happy path → inserts a `places` row with `status = "pending"`, calls `uploadPlacePhotos`, inserts `place_photos`, returns `{ ok: true }` (no slug leak of pending places is fine — return `{ ok: true }` only).

`src/app/api/submit/route.ts` (sketch): `POST`, `await request.formData()`, honeypot check (`company` field non-empty → return `{ ok: true }` without writing), `checkRateLimit(ip, { limit: 5, windowSec: 3600 })` where `ip = request.headers.get("cf-connecting-ip") ?? "local"`, `parsePlaceInput(fields)` → `400` with errors on failure, `slug = slugify(name) + "-" + shortId()` (put `slugify` in `src/lib/place-input.ts` from Task 7; add `shortId()` = `crypto.randomUUID().slice(0,8)` to a new `src/lib/slug.ts`), then:
```typescript
const supabase = createAdminClient();
const { data, error } = await supabase.rpc("insert_place", {
  p: { ...value, slug, status: "pending", submitter_email, submitter_note },
  p_lng: value.lng,
  p_lat: value.lat,
});
// data is the new uuid
const paths = await uploadPlacePhotos(data as string, files);
await supabase.from("place_photos").insert(
  paths.map((storage_path, i) => ({ place_id: data, storage_path, sort_order: i })),
);
return NextResponse.json({ ok: true });
```
Wrap in try/catch → 500. (`insert_place` is created in migration `0003`, Task 5.)

- [ ] **Step 2: `/submit` page**

`src/app/submit/page.tsx` — a server component: an intro (`font-display` heading, one line on how curation works) + `<PlaceForm mode="public" action={...} />`. The public `action` is a plain client function — `PlaceForm` resizes the photos, builds the `FormData`, and this just posts it:
```tsx
async (fd: FormData) => {
  const res = await fetch("/api/submit", { method: "POST", body: fd });
  return res.ok ? { ok: true } : { ok: false, error: (await res.json()).error ?? "Submission failed" };
}
```
No server action for public submit — `/api/submit` is the single implementation, identical whether hit by the form or a script.

- [ ] **Step 3: `/submit/thanks`**

A calm confirmation page — "Thanks — a curator will review it." + link back to the map.

- [ ] **Step 4: "＋ Add a place" entry point**

`src/components/AddPlaceButton.tsx` — a fixed bottom-right `Link` to `/submit`, styled as a small ink pill with the `.label` type. Render it in `HomeView` over the map view (not the list).

- [ ] **Step 5: Manual end-to-end**

`npm run dev` → `/submit` → fill it, geocode an address, nudge the pin, attach 1–2 photos, submit → lands on `/submit/thanks`. Confirm in Supabase (SQL editor) a `pending` row + `place_photos` exist and the photo opens at its public URL. It must **not** appear on `/` (still `pending`).

- [ ] **Step 6: Gate + commit**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A
git commit -m "$(cat <<'EOF'
feat: public place submission form and endpoint

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 11: Admin server actions

**Files:** create `src/app/admin/actions.ts`, `src/app/admin/actions.test.ts`

- [ ] **Step 1: TDD the actions**

`src/app/admin/actions.test.ts`: mock `@/lib/supabase/auth` (`getAdminUser`), `@/lib/supabase/admin`, `@/lib/storage`, `@/lib/place-input`, and `next/cache` (`revalidatePath`). For **every** action assert it throws / returns an error when `getAdminUser()` is `null`. Then:
- `publishPlace(id)` → updates `status: "published"`, `published_at` set, `revalidatePath("/")` + `revalidatePath("/admin")`.
- `rejectPlace(id, reason)` → `status: "rejected"`, `rejection_reason: reason`.
- `unpublishPlace(id)` → `status: "pending"`, `published_at: null`.
- `updatePlace(id, formData)` → validates via `parsePlaceInput`, updates the scalar fields on `places`, then `supabase.rpc("set_place_point", { p_id: id, p_lng, p_lat })` for the pin, replaces photos when new files are present (`uploadPlacePhotos` + delete old `place_photos` rows + insert new), `revalidatePath("/")` + `revalidatePath("/place/[slug]", "page")` + `revalidatePath("/admin")`.
- `createPlaceDirectly(formData)` → `parsePlaceInput`, `slug = slugify(name)+"-"+shortId()`, `supabase.rpc("insert_place", { p: {...fields, slug, status: "published", published_at: "now"}, p_lng, p_lat })` → `uploadPlacePhotos(newId, files)` → insert `place_photos` → `revalidatePath("/")`, returns `{ ok: true, slug }`.

Both `insert_place` and `set_place_point` are created in migration `0003` (Task 5) — no new migration here.

- [ ] **Step 2: Implement `src/app/admin/actions.ts`**

`"use server"` at the top. Each action starts:
```typescript
const user = await getAdminUser();
if (!user) throw new Error("Not authorized");
```
Then use `createAdminClient()` for the writes. `/api/submit` (Task 10) already calls `insert_place` with `status: "pending"`; `createPlaceDirectly` calls it with `status: "published"` — keep the shared shape so the two paths stay parallel. Add a tiny `shortId()` (`crypto.randomUUID().slice(0, 8)`) helper — or reuse the one Task 10 introduced (extract to `src/lib/slug.ts` if not already).

- [ ] **Step 3: Gate + commit**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A
git commit -m "$(cat <<'EOF'
feat(admin): publish/reject/unpublish/update/create server actions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 12: Review queue

**Files:** replace `src/app/admin/page.tsx`; create `src/components/admin/PlaceReviewCard.tsx`

- [ ] **Step 1: Queue page**

`src/app/admin/page.tsx` (server, `force-dynamic`): `const pending = await getPlacesByStatus("pending")`. Empty state: "Nothing waiting." Otherwise a list of `<PlaceReviewCard>`.

- [ ] **Step 2: `PlaceReviewCard`**

Shows every field: name (`font-display`), category, tags, description, why, address, a static `<PinPicker value={{lat,lng}} />` (or a read-only mini-map), the photos (`<PlacePhoto>`), submitter email + note + submitted-at in `.label`. Three controls wired to the Task 11 actions via `<form action={...}>`:
- **Publish** (vermilion) — `publishPlace.bind(null, id)`
- **Reject** — opens a small `rejection_reason` text input, `rejectPlace.bind(null, id)`
- **Edit** — `Link` to `/admin/${id}/edit`

- [ ] **Step 3: Manual check**

Log in → `/admin` shows the pending row from Task 10 with all its data + photo. Click **Publish** → it disappears from the queue and appears on `/`. Submit another, **Reject** it with a reason → gone from queue; confirm `status='rejected'` in SQL.

- [ ] **Step 4: Gate + commit**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A
git commit -m "$(cat <<'EOF'
feat(admin): review queue with publish and reject

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 13: Edit-then-publish, published list, add-directly

**Files:** create `src/app/admin/[id]/edit/page.tsx`, `src/app/admin/published/page.tsx`, `src/app/admin/new/page.tsx`

- [ ] **Step 1: Edit page**

`src/app/admin/[id]/edit/page.tsx` (server, `force-dynamic`): `getPlaceForAdmin(id)` → `notFound()` if null → `<PlaceForm mode="admin-edit" initial={...} action={updatePlace.bind(null, id)} />`. A "Publish" toggle/button if the place is still `pending` (calls `publishPlace` after save, or `updatePlace` accepts a `publish` flag). Prefill photos as existing `<PlacePhoto>` with remove buttons; new uploads append/replace.

- [ ] **Step 2: Published list**

`src/app/admin/published/page.tsx`: `getPlacesByStatus("published")`, a searchable (client-side filter box) index — name, category, an **Edit** link, an **Unpublish** button (`unpublishPlace.bind(null, id)`).

- [ ] **Step 3: Add directly**

`src/app/admin/new/page.tsx`: `<PlaceForm mode="admin-create" action={createPlaceDirectly} />`. On `{ ok, slug }` redirect to `/place/${slug}`.

- [ ] **Step 4: Manual check**

Edit a pending place → tweak the why text, nudge the pin, publish → live copy reflects the edit. Unpublish it from `/admin/published` → gone from `/`, back in the queue. Add a place directly → immediately at `/place/<slug>`.

- [ ] **Step 5: Gate + commit**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A
git commit -m "$(cat <<'EOF'
feat(admin): edit-then-publish, published list, add-directly

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 14: Wire photos into the public surfaces

**Files:** create `src/components/PlacePhoto.tsx`; modify `src/lib/geojson.ts`, `src/lib/places.ts` consumers, `src/app/place/[slug]/page.tsx`, `src/components/PlacePreviewSheet.tsx`, `src/components/PlaceCard.tsx`, `src/components/HomeView.tsx`, `src/app/api/places/geojson/route.ts`

- [ ] **Step 1: `PlacePhoto.tsx`**

`next/image` wrapper: takes `storage_path` + `alt` + sizing props, builds the URL with `photoUrl()` (extract `photoUrl` into a non-`server-only` `src/lib/photo-url.ts` since a client component needs it — it only needs `NEXT_PUBLIC_SUPABASE_URL`).

- [ ] **Step 2: Detail page gallery**

In `src/app/place/[slug]/page.tsx`: if `place.photos.length > 0`, render the first as the hero and the rest in a simple grid; else keep `<NoPhoto>`.

- [ ] **Step 3: Preview sheet + card thumbnails**

`PlacePreviewSheet`: the GeoJSON feature `properties` don't carry a photo. Add `thumb: string | null` (first photo's `storage_path`) to `PlaceFeature["properties"]` in `geojson.ts` and populate it in `placesToGeoJSON` (needs `PlacePublic.photos` — already present). Sheet shows `<PlacePhoto>` when `thumb`, else `<NoPhoto>`. `PlaceCard` already has `PlacePublic` — show first photo as the thumbnail when present.

- [ ] **Step 4: Update `geojson.test.ts` + `route.test.ts`**

Add the `thumb` property to the expected feature shape.

- [ ] **Step 5: Manual check**

The place you published in Task 12 now shows its photo on the map preview, in the list, and on the detail page.

- [ ] **Step 6: Gate + commit**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A
git commit -m "$(cat <<'EOF'
feat: show place photos on the map preview, list, and detail page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 15: Verify and deploy

- [ ] **Step 1: Full local gate + Workers preview**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
npm run preview
```
On `http://localhost:8787`: log in at `/admin/login` (the magic-link email's redirect must match `NEXT_PUBLIC_SITE_URL` — for a local preview test, temporarily set it to `http://localhost:8787` in `.dev.vars` or just verify the guard/redirect logic and test full auth on production). Confirm `/submit` works and a submission appears in `/admin`.

- [ ] **Step 2: Production config**

- `wrangler.jsonc` already carries `ADMIN_EMAIL` + `RATE_LIMIT` + `NEXT_PUBLIC_*` map vars.
- `NEXT_PUBLIC_SITE_URL` is inlined at build from `.env` (production value) — confirm `.env` has the workers.dev URL, not localhost.
- No new secrets (service-role key already set). Confirm: `npx wrangler secret list`.

- [ ] **Step 3: Wait for CI green, then deploy**

```bash
npm run deploy
```

- [ ] **Step 4: Production smoke test**

- `/admin/login` → magic link → lands on `/admin`.
- `/submit` → submit a real place with a photo → `/submit/thanks`.
- `/admin` → the submission shows with its photo → **Publish**.
- `/` and `/place/<slug>` → the place and its photo are live.
- Logged-out `/admin` → redirects to login.
- `curl` the raw `places` table with the anon key → still `permission denied`; `place-photos` object URL → 200.

- [ ] **Step 5: README + memory**

Add a Phase 2 line to `README.md` (submission + admin dashboard; `/admin` guarded by `ADMIN_EMAIL`). Update the project memory file: Phase 2 complete, the auth model (magic link → middleware → service-role writes), the `place-photos` bucket, KV `RATE_LIMIT`, the `insert_place` / `set_place_point` RPCs.

```bash
git add -A
git commit -m "$(cat <<'EOF'
docs: note Phase 2 write path in README

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Definition of done

- [ ] Logged-out `/admin/*` redirects to `/admin/login`; magic link to `ADMIN_EMAIL` grants access; other emails are refused.
- [ ] `/submit` creates a `pending` place + photos through the browser; honeypot and a 5/hour IP rate limit are enforced; the submission is invisible on public pages.
- [ ] `/admin` review queue shows every submitted field + photos + pin; **Publish**, **Reject (with reason)**, and **Edit-then-publish** all work.
- [ ] `/admin/published` lists live places with **Edit** and **Unpublish**.
- [ ] `/admin/new` publishes a place immediately.
- [ ] Photos appear on the map preview sheet, the list, and the detail page.
- [ ] `submitter_email` / `submitter_note` never appear in any public page, API, or GeoJSON.
- [ ] `npm run lint && npm run typecheck && npm run test:run && npm run build` pass; CI green on `main`; deployed and smoke-tested in production.

## Open questions carried to Phase 3

- Real image optimisation / thumbnails (currently one client-resized WebP per photo, `next/image` via the Cloudflare `IMAGES` binding).
- CAPTCHA / stronger anti-abuse if spam gets through honeypot + rate limit.
- Contributor accounts + "added by" credit (spec defers this).
- Custom MapLibre style, "near me", OG images (Phase 3).
- Multiple city editors / roles (spec defers).
- Email notification to the curator on new submissions.
