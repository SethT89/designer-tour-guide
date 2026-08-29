# Phase 1 — Read Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the empty Dallas basemap into a browsable public map of curated places — pins with clustering, a map/list toggle, category filter chips, and server-rendered place detail pages — backed by a real `places` schema in Supabase seeded with five Dallas design landmarks.

**Architecture:** A Postgres schema (`places`, `place_photos`) with PostGIS and RLS. The public roles have **no** access to the base tables; all reads go through a security-definer `places_public` view that filters to `status = 'published'`, flattens the geography point to `lng`/`lat`, and aggregates photos. Next.js server components read that view with an anon Supabase client; the home page passes initial data to a client `HomeView` that renders either a MapLibre map (clustered GeoJSON source, tap a pin → bottom sheet) or a list. `/place/[slug]` is server-rendered for shareable links. A cached `/api/places/geojson` route serves the pin data.

> **Note (execution):** Task 1/2 SQL code blocks below predate two fixes now in
> the real files — `set search_path = public, extensions;` at the top, and
> `revoke all ... from anon, authenticated` + a plain (security-definer) view
> instead of the ineffective column-level `revoke` + `security_invoker` view.
> Trust `supabase/migrations/*.sql` over the snippets.

**Tech Stack:** Next.js 16, MapLibre GL v6 (native clustering), Supabase (`@supabase/supabase-js`, PostGIS), Vitest.

---

## Context for the implementer

- **Read first:** the spec `docs/superpowers/specs/2026-08-28-designer-map-design.md` and the Phase 0 plan `docs/superpowers/plans/2026-08-28-phase-0-foundation.md` (its execution notes cover maplibre v6 quirks, the lockfile rule, `next typegen`).
- Phase 0 is live at `https://designer-tour-guide.sethmthomas89.workers.dev`. Supabase project ref `hrovkahgsbiygaymeovu`.
- **Migrations are applied via the Supabase CLI.** The project is linked
  (`npx supabase link --project-ref hrovkahgsbiygaymeovu`, done 2026-08-28), so
  `npx supabase db push` applies committed `.sql` files under
  `supabase/migrations/`. Migration files **must** start with
  `set search_path = public, extensions;` — the CLI runner does not put PostGIS's
  `extensions` schema on the path, unlike the dashboard SQL Editor.
- **Public reads never touch the base tables.** `revoke all on places,
  place_photos from anon, authenticated` (a column-level `REVOKE` is silently
  ineffective while Supabase's default privileges grant table-level `SELECT`).
  All reads go through the **security-definer** `places_public` view, whose
  `where status = 'published'` is the load-bearing filter. The Phase 2 admin
  dashboard uses the service-role client, which bypasses this.
- Existing Supabase clients: `src/lib/supabase/client.ts` (browser anon), `src/lib/supabase/admin.ts` (server service-role). This plan adds `src/lib/supabase/server.ts` (server anon, RLS-scoped — the default for public reads).
- **No photo upload in Phase 1.** The schema supports `place_photos`; seed places have none. Components render a graceful no-photo state. Real photos arrive once Phase 2 builds the upload tool.
- Conventional Commits; every commit ends with:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```
- After adding any npm dependency: `rm -rf node_modules package-lock.json && npm install`, then commit the lockfile (see Phase 0 Task 4 note). Phase 1 adds **no** new runtime deps.
- Run the full gate after each task: `npm run lint && npm run typecheck && npm run test:run && npm run build`.

## Category enum (fixed for MVP)

`architecture`, `interiors`, `graphic_signage`, `product_furniture`, `public_art`, `museum_gallery`, `shop`, `other`

Display labels: Architecture, Interiors, Graphic / Signage, Product / Furniture, Public Art, Museum / Gallery, Shop, Other.

## Seed places (5 real Dallas landmarks, no photos)

| name | category | lng | lat | address |
|---|---|---|---|---|
| Nasher Sculpture Center | `museum_gallery` | -96.7986 | 32.7880 | 2001 Flora St, Dallas, TX 75201 |
| Morton H. Meyerson Symphony Center | `architecture` | -96.7972 | 32.7897 | 2301 Flora St, Dallas, TX 75201 |
| Perot Museum of Nature and Science | `architecture` | -96.8064 | 32.7868 | 2201 N Field St, Dallas, TX 75202 |
| Klyde Warren Park | `other` | -96.8017 | 32.7893 | 2012 Woodall Rodgers Fwy, Dallas, TX 75201 |
| Pegasus (Magnolia Hotel) | `graphic_signage` | -96.7969 | 32.7802 | 1401 Commerce St, Dallas, TX 75201 |

`description` / `why` text is written in Task 2.

## File structure (created by this plan)

| Path | Responsibility |
|---|---|
| `supabase/migrations/0001_places_schema.sql` | postgis, enums, tables, indexes, RLS, column grants, `places_public` view |
| `supabase/migrations/0002_seed_dallas.sql` | the five seed places |
| `src/lib/categories.ts` | category values, labels, `categoryLabel()` |
| `src/lib/categories.test.ts` | tests |
| `src/lib/types.ts` | `PlacePublic`, `PlacePhoto`, `PlaceCategory`, `PlaceStatus` |
| `src/lib/supabase/server.ts` | server-side anon client (RLS-scoped) |
| `src/test/empty.ts` | empty-module alias target for `server-only` under Vitest |
| `src/lib/places.ts` | `getPublishedPlaces`, `getPlaceBySlug`, `placesToGeoJSON` |
| `src/lib/places.test.ts` | tests (supabase mocked) |
| `src/lib/maps-link.ts` | `openInMapsUrl()` helper |
| `src/lib/maps-link.test.ts` | tests |
| `src/app/api/places/geojson/route.ts` | published-places FeatureCollection |
| `src/app/api/places/geojson/route.test.ts` | tests |
| `src/components/MapView.tsx` | client: BaseMap + clustered places source/layers + tap handling |
| `src/components/MapView.test.tsx` | tests (maplibre mocked) |
| `src/components/PlacePreviewSheet.tsx` | bottom sheet shown on pin tap |
| `src/components/CategoryFilter.tsx` | filter chips |
| `src/components/PlaceCard.tsx` | one list card |
| `src/components/PlaceList.tsx` | list of cards |
| `src/components/HomeView.tsx` | client: map/list toggle + shared category-filter state |
| `src/components/no-photo.tsx` | shared styled no-photo placeholder |
| `src/app/place/[slug]/page.tsx` | SSR place detail + `generateMetadata` |
| `src/app/place/[slug]/not-found.tsx` | unknown-slug 404 |
| `src/app/page.tsx` | **modify** — server: `force-dynamic`, fetch initial data, render `HomeView` |
| `vitest.config.mts` | **modify** — alias `server-only` to an empty module |
| `src/components/HomeMap.tsx` | interim wrapper (Task 7), deleted in Task 10 |

---

## Task 1: Database schema

**Files:**
- Create: `supabase/migrations/0001_places_schema.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0001_places_schema.sql`:
```sql
-- Phase 1 — places / place_photos schema, RLS, and the public read view.

create extension if not exists postgis;

do $$ begin
  create type place_category as enum (
    'architecture','interiors','graphic_signage','product_furniture',
    'public_art','museum_gallery','shop','other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type place_status as enum ('pending','published','rejected');
exception when duplicate_object then null; end $$;

create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  why text not null default '',
  category place_category not null default 'other',
  tags text[] not null default '{}',
  location geography(Point, 4326) not null,
  address text not null default '',
  city text not null default '',
  country text not null default '',
  external_url text,
  status place_status not null default 'pending',
  submitter_email text,
  submitter_note text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists places_location_gix on places using gist (location);
create index if not exists places_status_idx on places (status);
create index if not exists places_category_idx on places (category);

create table if not exists place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  storage_path text not null,
  credit text,
  alt text not null default '',
  sort_order int not null default 0
);
create index if not exists place_photos_place_idx on place_photos (place_id, sort_order);

alter table places enable row level security;
alter table place_photos enable row level security;

drop policy if exists "published places are public" on places;
create policy "published places are public" on places
  for select using (status = 'published');

drop policy if exists "photos of published places are public" on place_photos;
create policy "photos of published places are public" on place_photos
  for select using (exists (
    select 1 from places p
    where p.id = place_photos.place_id and p.status = 'published'
  ));

-- Defense in depth: the public roles can never read these columns, even with
-- an explicit column list or a future `select *`.
revoke select (submitter_email, submitter_note, rejection_reason)
  on places from anon, authenticated;

-- Flattened, photo-joined public read model. security_invoker => RLS on the
-- base tables still applies to whoever queries the view.
drop view if exists places_public;
create view places_public
with (security_invoker = on) as
select
  p.id, p.name, p.slug, p.description, p.why, p.category, p.tags,
  st_x(p.location::geometry) as lng,
  st_y(p.location::geometry) as lat,
  p.address, p.city, p.country, p.external_url, p.published_at,
  coalesce((
    select json_agg(json_build_object(
      'storage_path', ph.storage_path,
      'credit', ph.credit,
      'alt', ph.alt,
      'sort_order', ph.sort_order
    ) order by ph.sort_order)
    from place_photos ph where ph.place_id = p.id
  ), '[]'::json) as photos
from places p
where p.status = 'published';

grant select on places_public to anon, authenticated;
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: `Applying migration 0001_places_schema.sql...` then `Finished supabase db push.`

- [ ] **Step 3: Verify the schema exists**

Ask the human to run this in a new SQL Editor query and paste the result:
```sql
select
  (select count(*) from pg_type where typname = 'place_category') as has_cat_enum,
  (select count(*) from information_schema.tables where table_name = 'places') as has_places,
  (select count(*) from information_schema.tables where table_name = 'place_photos') as has_photos,
  (select count(*) from information_schema.views where table_name = 'places_public') as has_view,
  (select count(*) from pg_extension where extname = 'postgis') as has_postgis;
```
Expected: every column returns `1`.

- [ ] **Step 4: Verify RLS blocks unpublished rows via the anon key**

Run locally (uses the committed anon key):
```bash
curl -s "https://hrovkahgsbiygaymeovu.supabase.co/rest/v1/places?select=id" \
  -H "apikey: $(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env | cut -d= -f2-)"
```
Expected: `[]` (no rows — nothing published yet, and pending/rejected are invisible).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_places_schema.sql
git commit -m "$(cat <<'EOF'
feat(db): places/place_photos schema, RLS, and places_public view

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 2: Seed data

**Files:**
- Create: `supabase/migrations/0002_seed_dallas.sql`

- [ ] **Step 1: Write the seed migration**

Create `supabase/migrations/0002_seed_dallas.sql`:
```sql
-- Phase 1 — five Dallas design landmarks. Idempotent on slug.

insert into places (name, slug, description, why, category, tags, location, address, city, country, status, published_at)
values
  (
    'Nasher Sculpture Center',
    'nasher-sculpture-center',
    'A single-storey museum and garden dedicated to modern and contemporary sculpture, opened in 2003.',
    'Renzo Piano''s travertine-and-glass pavilions with their cast-glass sunshade roof, opening onto a Peter Walker garden — a masterclass in daylighting and indoor/outdoor flow.',
    'museum_gallery',
    array['renzo piano','daylighting','garden','travertine'],
    st_setsrid(st_makepoint(-96.7986, 32.7880), 4326)::geography,
    '2001 Flora St, Dallas, TX 75201', 'Dallas', 'USA',
    'published', now()
  ),
  (
    'Morton H. Meyerson Symphony Center',
    'meyerson-symphony-center',
    'The Dallas Symphony Orchestra''s concert hall, completed in 1989.',
    'I.M. Pei / Pei Cobb Freed — a curved limestone lobby wrapped in glass, with a shoebox hall by acoustician Russell Johnson. The geometry of the conoid lobby vault is worth the visit alone.',
    'architecture',
    array['i m pei','acoustics','limestone','civic'],
    st_setsrid(st_makepoint(-96.7972, 32.7897), 4326)::geography,
    '2301 Flora St, Dallas, TX 75201', 'Dallas', 'USA',
    'published', now()
  ),
  (
    'Perot Museum of Nature and Science',
    'perot-museum',
    'A natural-science museum in Victory Park, opened in 2012.',
    'Thom Mayne / Morphosis — a striated concrete cube with a glass-enclosed escalator cantilevered off the facade and a native-landscape roof. Bold massing, hard edges.',
    'architecture',
    array['morphosis','thom mayne','concrete','brutalist-adjacent'],
    st_setsrid(st_makepoint(-96.8064, 32.7868), 4326)::geography,
    '2201 N Field St, Dallas, TX 75202', 'Dallas', 'USA',
    'published', now()
  ),
  (
    'Klyde Warren Park',
    'klyde-warren-park',
    'A 5.2-acre deck park built over the recessed Woodall Rodgers Freeway, opened in 2012.',
    'The Office of James Burnett turned a sunken highway into a connective public room — a case study in landscape as infrastructure, with a clear kit of parts (allees, lawn, pavilions).',
    'other',
    array['landscape','deck park','ojb','public space'],
    st_setsrid(st_makepoint(-96.8017, 32.7893), 4326)::geography,
    '2012 Woodall Rodgers Fwy, Dallas, TX 75201', 'Dallas', 'USA',
    'published', now()
  ),
  (
    'Pegasus (Magnolia Hotel)',
    'pegasus-magnolia-hotel',
    'The restored 1934 rotating neon Pegasus sign atop the Magnolia Hotel downtown.',
    'A perfect piece of pre-war commercial signage — the flying red horse as civic mascot. The 1999 restoration and the 2015 ground-level original are both instructive on neon craft.',
    'graphic_signage',
    array['neon','signage','1930s','landmark'],
    st_setsrid(st_makepoint(-96.7969, 32.7802), 4326)::geography,
    '1401 Commerce St, Dallas, TX 75201', 'Dallas', 'USA',
    'published', now()
  )
on conflict (slug) do nothing;
```

- [ ] **Step 2: Apply the seed**

Run: `npx supabase db push`
Expected: `Applying migration 0002_seed_dallas.sql...` then `Finished supabase db push.`

- [ ] **Step 3: Verify via the anon REST API**

```bash
curl -s "https://hrovkahgsbiygaymeovu.supabase.co/rest/v1/places_public?select=name,slug,category,lng,lat&order=name" \
  -H "apikey: $(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env | cut -d= -f2-)" | python3 -m json.tool
```
Expected: 5 objects, each with a numeric `lng` around -96.8 and `lat` around 32.79, and no `submitter_email` key anywhere.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_seed_dallas.sql
git commit -m "$(cat <<'EOF'
feat(db): seed five Dallas design landmarks

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 3: Categories module

**Files:**
- Create: `src/lib/categories.ts`, `src/lib/categories.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/categories.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { PLACE_CATEGORIES, categoryLabel } from "./categories";

describe("categories", () => {
  it("lists the eight MVP categories in a stable order", () => {
    expect(PLACE_CATEGORIES).toEqual([
      "architecture",
      "interiors",
      "graphic_signage",
      "product_furniture",
      "public_art",
      "museum_gallery",
      "shop",
      "other",
    ]);
  });

  it("maps a value to a display label", () => {
    expect(categoryLabel("graphic_signage")).toBe("Graphic / Signage");
    expect(categoryLabel("museum_gallery")).toBe("Museum / Gallery");
    expect(categoryLabel("other")).toBe("Other");
  });

  it("falls back to the raw value for an unknown category", () => {
    // @ts-expect-error deliberately invalid
    expect(categoryLabel("nope")).toBe("nope");
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npm run test:run -- src/lib/categories.test.ts`
Expected: FAIL — `Cannot find module './categories'`.

- [ ] **Step 3: Implement**

Create `src/lib/categories.ts`:
```typescript
export const PLACE_CATEGORIES = [
  "architecture",
  "interiors",
  "graphic_signage",
  "product_furniture",
  "public_art",
  "museum_gallery",
  "shop",
  "other",
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

const LABELS: Record<PlaceCategory, string> = {
  architecture: "Architecture",
  interiors: "Interiors",
  graphic_signage: "Graphic / Signage",
  product_furniture: "Product / Furniture",
  public_art: "Public Art",
  museum_gallery: "Museum / Gallery",
  shop: "Shop",
  other: "Other",
};

export function categoryLabel(value: PlaceCategory): string {
  return LABELS[value] ?? value;
}
```

- [ ] **Step 4: Run it, expect pass**

Run: `npm run test:run -- src/lib/categories.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/categories.ts src/lib/categories.test.ts
git commit -m "$(cat <<'EOF'
feat: place category values and display labels

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Types and the server anon client

**Files:**
- Create: `src/lib/types.ts`, `src/lib/supabase/server.ts`

- [ ] **Step 1: Create the types**

Create `src/lib/types.ts`:
```typescript
import type { PlaceCategory } from "./categories";

export type PlaceStatus = "pending" | "published" | "rejected";

export type PlacePhoto = {
  storage_path: string;
  credit: string | null;
  alt: string;
  sort_order: number;
};

/** A row from the `places_public` view — safe for the browser. */
export type PlacePublic = {
  id: string;
  name: string;
  slug: string;
  description: string;
  why: string;
  category: PlaceCategory;
  tags: string[];
  lng: number;
  lat: number;
  address: string;
  city: string;
  country: string;
  external_url: string | null;
  published_at: string | null;
  photos: PlacePhoto[];
};
```

- [ ] **Step 2: Create the server anon client**

Create `src/lib/supabase/server.ts`:
```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the anon key. RLS applies, so this only ever
 * sees `published` rows — the default for all public reads. Use `admin.ts` only
 * for the review dashboard (Phase 2).
 */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 3: Stub `server-only` for Vitest**

`server.ts` (and Phase 0's `admin.ts`) import `server-only`, which throws when
loaded outside a React Server Component — including under Vitest. Later tests
import modules that transitively pull it in. Alias it to an empty module.

Create `src/test/empty.ts`:
```typescript
export {};
```

In `vitest.config.mts`, add to `resolve.alias`:
```typescript
    "server-only": new URL("./src/test/empty.ts", import.meta.url).pathname,
```
(Keep the existing `"@"` alias alongside it.)

- [ ] **Step 4: Verify it compiles and existing tests still pass**

Run: `npm run typecheck && npm run test:run`
Expected: exit 0; the 8 Phase 0 tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/supabase/server.ts src/test/empty.ts vitest.config.mts
git commit -m "$(cat <<'EOF'
feat: PlacePublic types and the RLS-scoped server client

Also stubs server-only for Vitest so server modules can be imported in tests.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: The `places` data layer

**Files:**
- Create: `src/lib/places.ts`, `src/lib/places.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/places.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PlacePublic } from "./types";

const from = vi.fn();
vi.mock("./supabase/server", () => ({
  createServerClient: () => ({ from }),
}));

import { getPublishedPlaces, getPlaceBySlug, placesToGeoJSON } from "./places";

const row: PlacePublic = {
  id: "1",
  name: "Nasher Sculpture Center",
  slug: "nasher-sculpture-center",
  description: "d",
  why: "w",
  category: "museum_gallery",
  tags: ["renzo piano"],
  lng: -96.7986,
  lat: 32.788,
  address: "2001 Flora St",
  city: "Dallas",
  country: "USA",
  external_url: null,
  published_at: "2026-08-28T00:00:00Z",
  photos: [],
};

beforeEach(() => from.mockReset());

describe("getPublishedPlaces", () => {
  it("returns rows ordered by city then name", async () => {
    const order2 = vi.fn().mockResolvedValue({ data: [row], error: null });
    const order1 = vi.fn().mockReturnValue({ order: order2 });
    const select = vi.fn().mockReturnValue({ order: order1 });
    from.mockReturnValue({ select });

    const places = await getPublishedPlaces();

    expect(from).toHaveBeenCalledWith("places_public");
    expect(order1).toHaveBeenCalledWith("city");
    expect(order2).toHaveBeenCalledWith("name");
    expect(places).toEqual([row]);
  });

  it("throws on a query error", async () => {
    const order2 = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "boom" } });
    const order1 = vi.fn().mockReturnValue({ order: order2 });
    const select = vi.fn().mockReturnValue({ order: order1 });
    from.mockReturnValue({ select });

    await expect(getPublishedPlaces()).rejects.toThrow("boom");
  });
});

describe("getPlaceBySlug", () => {
  it("returns a single row or null", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    from.mockReturnValue({ select });

    const place = await getPlaceBySlug("nasher-sculpture-center");

    expect(eq).toHaveBeenCalledWith("slug", "nasher-sculpture-center");
    expect(place).toEqual(row);
  });
});

describe("placesToGeoJSON", () => {
  it("builds a FeatureCollection of Points with lng/lat order", () => {
    const fc = placesToGeoJSON([row]);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features[0]).toEqual({
      type: "Feature",
      geometry: { type: "Point", coordinates: [-96.7986, 32.788] },
      properties: {
        id: "1",
        name: "Nasher Sculpture Center",
        slug: "nasher-sculpture-center",
        category: "museum_gallery",
      },
    });
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npm run test:run -- src/lib/places.test.ts`
Expected: FAIL — `Cannot find module './places'`.

- [ ] **Step 3: Implement**

Create `src/lib/places.ts`:
```typescript
import "server-only";
import { createServerClient } from "./supabase/server";
import type { PlaceCategory } from "./categories";
import type { PlacePublic } from "./types";

const COLUMNS =
  "id,name,slug,description,why,category,tags,lng,lat,address,city,country,external_url,published_at,photos";

export async function getPublishedPlaces(): Promise<PlacePublic[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("places_public")
    .select(COLUMNS)
    .order("city")
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as PlacePublic[];
}

export async function getPlaceBySlug(slug: string): Promise<PlacePublic | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("places_public")
    .select(COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as PlacePublic | null) ?? null;
}

export type PlaceFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    id: string;
    name: string;
    slug: string;
    category: PlaceCategory;
  };
};

export type PlaceFeatureCollection = {
  type: "FeatureCollection";
  features: PlaceFeature[];
};

export function placesToGeoJSON(places: PlacePublic[]): PlaceFeatureCollection {
  return {
    type: "FeatureCollection",
    features: places.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        name: p.name,
        slug: p.slug,
        category: p.category,
      },
    })),
  };
}
```

- [ ] **Step 4: Run it, expect pass**

Run: `npm run test:run -- src/lib/places.test.ts`
Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/places.ts src/lib/places.test.ts
git commit -m "$(cat <<'EOF'
feat: server-side places data layer and GeoJSON transform

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `/api/places/geojson` route

**Files:**
- Create: `src/app/api/places/geojson/route.ts`, `src/app/api/places/geojson/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/places/geojson/route.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const getPublishedPlaces = vi.fn();
vi.mock("@/lib/places", async (orig) => ({
  ...(await orig<typeof import("@/lib/places")>()),
  getPublishedPlaces,
}));

beforeEach(() => getPublishedPlaces.mockReset());

import { GET } from "./route";

describe("GET /api/places/geojson", () => {
  it("returns a FeatureCollection with a cache header", async () => {
    getPublishedPlaces.mockResolvedValue([
      {
        id: "1",
        name: "X",
        slug: "x",
        category: "shop",
        lng: -96.8,
        lat: 32.8,
        description: "",
        why: "",
        tags: [],
        address: "",
        city: "Dallas",
        country: "USA",
        external_url: null,
        published_at: null,
        photos: [],
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage");
    const body = await res.json();
    expect(body.type).toBe("FeatureCollection");
    expect(body.features).toHaveLength(1);
    expect(body.features[0].geometry.coordinates).toEqual([-96.8, 32.8]);
  });

  it("returns 500 on failure", async () => {
    getPublishedPlaces.mockRejectedValue(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npm run test:run -- src/app/api/places/geojson/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement**

Create `src/app/api/places/geojson/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getPublishedPlaces, placesToGeoJSON } from "@/lib/places";

export async function GET() {
  try {
    const places = await getPublishedPlaces();
    return NextResponse.json(placesToGeoJSON(places), {
      headers: {
        // Edge-cache for 5 min, serve stale for a day while revalidating.
        "cache-control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Run it, expect pass**

Run: `npm run test:run -- src/app/api/places/geojson/route.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Manual check against the real DB**

Run `npm run dev`, then:
```bash
curl -s localhost:3000/api/places/geojson | python3 -m json.tool | head -30
```
Expected: a FeatureCollection with 5 features. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/places
git commit -m "$(cat <<'EOF'
feat: cached /api/places/geojson route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Map with clustered pins

Refactor: `BaseMap` currently owns the whole map. Extract the places layer into a new `MapView` that renders the map itself (so `BaseMap` can retire) — simpler than threading a map instance through context.

**Files:**
- Create: `src/components/MapView.tsx`, `src/components/MapView.test.tsx`
- Modify: `src/app/page.tsx` (temporarily, finalised in Task 10), `src/components/BaseMap.tsx` + `src/components/BaseMap.test.tsx` (delete)

- [ ] **Step 1: Write the failing test**

Create `src/components/MapView.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { PlaceFeatureCollection } from "@/lib/places";

const addSource = vi.fn();
const addLayer = vi.fn();
const on = vi.fn();
const addControl = vi.fn();
const remove = vi.fn();
const mapCtor = vi.fn();

vi.mock("maplibre-gl", () => ({
  Map: class {
    constructor(opts: unknown) {
      mapCtor(opts);
    }
    on = on;
    addControl = addControl;
    addSource = addSource;
    addLayer = addLayer;
    remove = remove;
    getSource = vi.fn();
  },
  NavigationControl: class {},
  setWorkerUrl: vi.fn(),
}));

import { MapView } from "./MapView";

const fc: PlaceFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-96.8, 32.8] },
      properties: { id: "1", name: "X", slug: "x", category: "shop" },
    },
  ],
};

beforeEach(() => {
  [addSource, addLayer, on, addControl, remove, mapCtor].forEach((m) =>
    m.mockReset(),
  );
});

describe("MapView", () => {
  it("renders a map container", () => {
    const { container } = render(<MapView data={fc} onSelect={() => {}} />);
    expect(container.querySelector("[data-testid='base-map']")).not.toBeNull();
  });

  it("centres on Dallas", () => {
    render(<MapView data={fc} onSelect={() => {}} />);
    const opts = mapCtor.mock.calls[0][0] as { center: [number, number] };
    expect(opts.center).toEqual([-96.797, 32.7767]);
  });

  it("registers a load handler that adds the clustered source", () => {
    render(<MapView data={fc} onSelect={() => {}} />);
    const load = on.mock.calls.find((c) => c[0] === "load")?.[1] as () => void;
    expect(load).toBeTypeOf("function");
    load();
    expect(addSource).toHaveBeenCalledWith(
      "places",
      expect.objectContaining({ type: "geojson", cluster: true }),
    );
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npm run test:run -- src/components/MapView.test.tsx`
Expected: FAIL — `Cannot find module './MapView'`.

- [ ] **Step 3: Implement `MapView`**

Create `src/components/MapView.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, NavigationControl } from "maplibre-gl";
import { getMapConfig } from "@/lib/config";
import { configureMapLibre } from "@/lib/maplibre";
import type { PlaceFeature, PlaceFeatureCollection } from "@/lib/places";

type Props = {
  data: PlaceFeatureCollection;
  onSelect: (feature: PlaceFeature["properties"]) => void;
};

const SOURCE = "places";

export function MapView({ data, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current) return;
    configureMapLibre();
    const { center, zoom, styleUrl } = getMapConfig();

    const map = new MapLibreMap({
      container: containerRef.current,
      style: styleUrl,
      center,
      zoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource(SOURCE, {
        type: "geojson",
        data: dataRef.current,
        cluster: true,
        clusterRadius: 50,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: SOURCE,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#1d1d1f",
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 30, 28],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: SOURCE,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "place",
        type: "circle",
        source: SOURCE,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#e8483c",
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "clusters", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const coords = (f.geometry as GeoJSON.Point).coordinates as [
          number,
          number,
        ];
        map.easeTo({ center: coords, zoom: map.getZoom() + 2 });
      });
      map.on("click", "place", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        onSelectRef.current(
          f.properties as PlaceFeature["properties"],
        );
      });
      for (const layer of ["clusters", "place"]) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Push new data (e.g. category filter) into the live source.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(SOURCE) as
      | { setData: (d: PlaceFeatureCollection) => void }
      | undefined;
    src?.setData(data);
  }, [data]);

  return (
    <div ref={containerRef} data-testid="base-map" className="h-full w-full" />
  );
}
```

- [ ] **Step 4: Run it, expect pass**

Run: `npm run test:run -- src/components/MapView.test.tsx`
Expected: `3 passed`.

- [ ] **Step 5: Delete `BaseMap`**

```bash
git rm src/components/BaseMap.tsx src/components/BaseMap.test.tsx
```

- [ ] **Step 6: Point the home page at `MapView` (interim)**

Replace `src/app/page.tsx`:
```tsx
import { getPublishedPlaces, placesToGeoJSON } from "@/lib/places";
import { HomeMap } from "@/components/HomeMap";

// Reads the DB per request — never prerender (CI build has no real Supabase).
export const dynamic = "force-dynamic";

export default async function Home() {
  const places = await getPublishedPlaces();
  return (
    <main className="h-dvh w-full">
      <HomeMap data={placesToGeoJSON(places)} />
    </main>
  );
}
```

Create a thin client wrapper `src/components/HomeMap.tsx` (replaced in Task 10):
```tsx
"use client";

import { MapView } from "./MapView";
import type { PlaceFeatureCollection } from "@/lib/places";

export function HomeMap({ data }: { data: PlaceFeatureCollection }) {
  return <MapView data={data} onSelect={(p) => console.log("selected", p.slug)} />;
}
```

- [ ] **Step 7: Full gate + manual check**

Run: `npm run lint && npm run typecheck && npm run test:run && npm run build`
Then `npm run dev` and confirm in the browser: five red pins over central Dallas, clicking empty space does nothing, clicking a cluster (zoom out first) zooms in. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: clustered places map, retiring BaseMap

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 8: Pin tap → preview sheet

**Files:**
- Create: `src/components/PlacePreviewSheet.tsx`, `src/components/no-photo.tsx`
- Modify: `src/components/HomeMap.tsx`

**Design:** follow `frontend-design` skill guidance — a mobile bottom sheet, ~40% viewport height, rounded top corners, drag/tap-out to dismiss, one hero image area (or `NoPhoto`), name, category label, and a "View details →" link to `/place/[slug]`.

- [ ] **Step 1: Create the no-photo placeholder**

Create `src/components/no-photo.tsx`:
```tsx
import { categoryLabel } from "@/lib/categories";
import type { PlaceCategory } from "@/lib/categories";

export function NoPhoto({ category }: { category: PlaceCategory }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-neutral-400">
      <span className="text-sm uppercase tracking-wide">
        {categoryLabel(category)}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Create the preview sheet**

Create `src/components/PlacePreviewSheet.tsx`:
```tsx
"use client";

import Link from "next/link";
import { categoryLabel } from "@/lib/categories";
import { NoPhoto } from "./no-photo";
import type { PlaceFeature } from "@/lib/places";

type Props = {
  place: PlaceFeature["properties"] | null;
  onClose: () => void;
};

export function PlacePreviewSheet({ place, onClose }: Props) {
  if (!place) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute -top-16 right-4 h-10 w-10 rounded-full bg-black/60 text-white"
      >
        ✕
      </button>
      <div className="mx-auto max-w-md rounded-t-2xl bg-white shadow-2xl">
        <div className="h-40 overflow-hidden rounded-t-2xl">
          <NoPhoto category={place.category} />
        </div>
        <div className="space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            {categoryLabel(place.category)}
          </p>
          <h2 className="text-lg font-semibold">{place.name}</h2>
          <Link
            href={`/place/${place.slug}`}
            className="inline-block pt-2 text-sm font-medium text-blue-600"
          >
            View details →
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire it into `HomeMap`**

Replace `src/components/HomeMap.tsx`:
```tsx
"use client";

import { useState } from "react";
import { MapView } from "./MapView";
import { PlacePreviewSheet } from "./PlacePreviewSheet";
import type { PlaceFeature, PlaceFeatureCollection } from "@/lib/places";

export function HomeMap({ data }: { data: PlaceFeatureCollection }) {
  const [selected, setSelected] = useState<
    PlaceFeature["properties"] | null
  >(null);

  return (
    <div className="relative h-full w-full">
      <MapView data={data} onSelect={setSelected} />
      <PlacePreviewSheet place={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
```

- [ ] **Step 4: Gate + manual check**

Run the full gate. Then `npm run dev`: tap a pin → sheet slides up with the category + name; "View details" link points at `/place/<slug>`; ✕ dismisses. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: place preview bottom sheet on pin tap

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Category filter chips

The filter lives in `HomeView` (Task 10) so it can drive both map and list, but build and test the presentational component now.

**Files:**
- Create: `src/components/CategoryFilter.tsx`, `src/components/CategoryFilter.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/CategoryFilter.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryFilter } from "./CategoryFilter";

describe("CategoryFilter", () => {
  it("renders an 'All' chip plus one per category", () => {
    render(<CategoryFilter selected={null} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Graphic / Signage" }),
    ).toBeInTheDocument();
  });

  it("calls onChange with the category, and null when 'All' is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CategoryFilter selected="shop" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Architecture" }));
    expect(onChange).toHaveBeenCalledWith("architecture");

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npm run test:run -- src/components/CategoryFilter.test.tsx`
Expected: FAIL — `Cannot find module './CategoryFilter'`.

- [ ] **Step 3: Implement**

Create `src/components/CategoryFilter.tsx`:
```tsx
"use client";

import { PLACE_CATEGORIES, categoryLabel } from "@/lib/categories";
import type { PlaceCategory } from "@/lib/categories";

type Props = {
  selected: PlaceCategory | null;
  onChange: (value: PlaceCategory | null) => void;
};

export function CategoryFilter({ selected, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto p-3">
      <Chip active={selected === null} onClick={() => onChange(null)}>
        All
      </Chip>
      {PLACE_CATEGORIES.map((c) => (
        <Chip key={c} active={selected === c} onClick={() => onChange(c)}>
          {categoryLabel(c)}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${
        active
          ? "border-black bg-black text-white"
          : "border-neutral-300 bg-white text-neutral-700"
      }`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Run it, expect pass**

Run: `npm run test:run -- src/components/CategoryFilter.test.tsx`
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/components/CategoryFilter.tsx src/components/CategoryFilter.test.tsx
git commit -m "$(cat <<'EOF'
feat: category filter chips

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: List view and the map/list toggle

**Files:**
- Create: `src/components/PlaceCard.tsx`, `src/components/PlaceList.tsx`, `src/components/HomeView.tsx`
- Modify: `src/app/page.tsx`; delete `src/components/HomeMap.tsx`

- [ ] **Step 1: Create `PlaceCard`**

Create `src/components/PlaceCard.tsx`:
```tsx
import Link from "next/link";
import { categoryLabel } from "@/lib/categories";
import { NoPhoto } from "./no-photo";
import type { PlacePublic } from "@/lib/types";

export function PlaceCard({ place }: { place: PlacePublic }) {
  return (
    <Link
      href={`/place/${place.slug}`}
      className="flex gap-3 rounded-xl border border-neutral-200 p-3"
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg">
        <NoPhoto category={place.category} />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          {categoryLabel(place.category)}
        </p>
        <h3 className="truncate font-semibold">{place.name}</h3>
        <p className="truncate text-sm text-neutral-600">{place.address}</p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create `PlaceList` with a test**

Create `src/components/PlaceList.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlaceList } from "./PlaceList";
import type { PlacePublic } from "@/lib/types";

const base: PlacePublic = {
  id: "1",
  name: "Nasher",
  slug: "nasher",
  description: "",
  why: "",
  category: "museum_gallery",
  tags: [],
  lng: -96.8,
  lat: 32.8,
  address: "2001 Flora St",
  city: "Dallas",
  country: "USA",
  external_url: null,
  published_at: null,
  photos: [],
};

describe("PlaceList", () => {
  it("shows all places when no category is selected", () => {
    render(<PlaceList places={[base, { ...base, id: "2", slug: "b", name: "B", category: "shop" }]} category={null} />);
    expect(screen.getByText("Nasher")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("filters by category", () => {
    render(<PlaceList places={[base, { ...base, id: "2", slug: "b", name: "B", category: "shop" }]} category="shop" />);
    expect(screen.queryByText("Nasher")).not.toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", () => {
    render(<PlaceList places={[base]} category="shop" />);
    expect(screen.getByText(/no places/i)).toBeInTheDocument();
  });
});
```

Create `src/components/PlaceList.tsx`:
```tsx
import { PlaceCard } from "./PlaceCard";
import type { PlaceCategory } from "@/lib/categories";
import type { PlacePublic } from "@/lib/types";

export function PlaceList({
  places,
  category,
}: {
  places: PlacePublic[];
  category: PlaceCategory | null;
}) {
  const shown = category
    ? places.filter((p) => p.category === category)
    : places;

  if (shown.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-neutral-500">
        No places in this category yet.
      </p>
    );
  }

  return (
    <div className="space-y-3 p-3">
      {shown.map((p) => (
        <PlaceCard key={p.id} place={p} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Run the list test, expect pass**

Run: `npm run test:run -- src/components/PlaceList.test.tsx`
Expected: `3 passed`.

- [ ] **Step 4: Create `HomeView`**

Create `src/components/HomeView.tsx`:
```tsx
"use client";

import { useMemo, useState } from "react";
import { MapView } from "./MapView";
import { PlacePreviewSheet } from "./PlacePreviewSheet";
import { PlaceList } from "./PlaceList";
import { CategoryFilter } from "./CategoryFilter";
import { placesToGeoJSON } from "@/lib/places";
import type { PlaceCategory } from "@/lib/categories";
import type { PlaceFeature } from "@/lib/places";
import type { PlacePublic } from "@/lib/types";

export function HomeView({ places }: { places: PlacePublic[] }) {
  const [view, setView] = useState<"map" | "list">("map");
  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [selected, setSelected] = useState<
    PlaceFeature["properties"] | null
  >(null);

  const filtered = useMemo(
    () => (category ? places.filter((p) => p.category === category) : places),
    [places, category],
  );
  const geojson = useMemo(() => placesToGeoJSON(filtered), [filtered]);

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200">
        <CategoryFilter selected={category} onChange={setCategory} />
        <div className="flex shrink-0 gap-1 p-3">
          <ToggleButton active={view === "map"} onClick={() => setView("map")}>
            Map
          </ToggleButton>
          <ToggleButton active={view === "list"} onClick={() => setView("list")}>
            List
          </ToggleButton>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {view === "map" ? (
          <>
            <MapView data={geojson} onSelect={setSelected} />
            <PlacePreviewSheet
              place={selected}
              onClose={() => setSelected(null)}
            />
          </>
        ) : (
          <div className="h-full overflow-y-auto">
            <PlaceList places={places} category={category} />
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm ${
        active ? "bg-black text-white" : "bg-neutral-100 text-neutral-700"
      }`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 5: Rewire the home page**

Replace `src/app/page.tsx`:
```tsx
import { getPublishedPlaces } from "@/lib/places";
import { HomeView } from "@/components/HomeView";

export const dynamic = "force-dynamic";

export default async function Home() {
  const places = await getPublishedPlaces();
  return <HomeView places={places} />;
}
```

```bash
git rm src/components/HomeMap.tsx
```

- [ ] **Step 6: Gate + manual check**

Run the full gate. Then `npm run dev`:
- Map view: filter chips reduce the visible pins; toggling to List shows cards; a chip then filters the list; clicking a card opens `/place/<slug>` (404 until Task 11).
- Stop the server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: map/list toggle with shared category filter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 11: Place detail page

**Files:**
- Create: `src/lib/maps-link.ts`, `src/lib/maps-link.test.ts`, `src/app/place/[slug]/page.tsx`, `src/app/place/[slug]/not-found.tsx`

**Design:** follow `frontend-design` skill guidance — mobile-first, single column: hero (`NoPhoto` for now), name, category + tags, the `why` paragraph set apart from `description`, an address block with an "Open in Maps" link, and the external link if present.

- [ ] **Step 1: Write the failing test for `maps-link`**

Create `src/lib/maps-link.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { openInMapsUrl } from "./maps-link";

describe("openInMapsUrl", () => {
  it("builds a geo query from name + coords", () => {
    expect(openInMapsUrl({ name: "Nasher Sculpture Center", lat: 32.788, lng: -96.7986 })).toBe(
      "https://www.google.com/maps/search/?api=1&query=32.788%2C-96.7986%20Nasher%20Sculpture%20Center",
    );
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npm run test:run -- src/lib/maps-link.test.ts`
Expected: FAIL — `Cannot find module './maps-link'`.

- [ ] **Step 3: Implement**

Create `src/lib/maps-link.ts`:
```typescript
export function openInMapsUrl({
  name,
  lat,
  lng,
}: {
  name: string;
  lat: number;
  lng: number;
}): string {
  const query = encodeURIComponent(`${lat},${lng} ${name}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
```

- [ ] **Step 4: Run it, expect pass**

Run: `npm run test:run -- src/lib/maps-link.test.ts`
Expected: `1 passed`.

- [ ] **Step 5: Create the not-found page**

Create `src/app/place/[slug]/not-found.tsx`:
```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold">Place not found</h1>
      <p className="mt-2 text-neutral-600">
        This place may not be published yet.
      </p>
      <Link href="/" className="mt-4 inline-block text-blue-600">
        ← Back to the map
      </Link>
    </main>
  );
}
```

- [ ] **Step 6: Create the detail page**

Create `src/app/place/[slug]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPlaceBySlug } from "@/lib/places";
import { categoryLabel } from "@/lib/categories";
import { openInMapsUrl } from "@/lib/maps-link";
import { NoPhoto } from "@/components/no-photo";

type Params = { params: Promise<{ slug: string }> };

// Rendered per request; no generateStaticParams, no build-time DB access.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);
  if (!place) return { title: "Place not found — Designer Map" };
  return {
    title: `${place.name} — Designer Map`,
    description: place.why || place.description,
  };
}

export default async function PlacePage({ params }: Params) {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);
  if (!place) notFound();

  return (
    <main className="mx-auto max-w-2xl pb-16">
      <div className="h-56 w-full overflow-hidden sm:h-72">
        <NoPhoto category={place.category} />
      </div>

      <div className="space-y-4 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            {categoryLabel(place.category)}
          </p>
          <h1 className="text-2xl font-semibold">{place.name}</h1>
        </div>

        {place.why && (
          <p className="border-l-2 border-neutral-900 pl-3 text-neutral-800">
            {place.why}
          </p>
        )}
        {place.description && (
          <p className="text-neutral-600">{place.description}</p>
        )}

        {place.tags.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {place.tags.map((t) => (
              <li
                key={t}
                className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600"
              >
                {t}
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-xl border border-neutral-200 p-3 text-sm">
          <p className="text-neutral-800">{place.address}</p>
          <a
            className="mt-1 inline-block text-blue-600"
            href={openInMapsUrl({ name: place.name, lat: place.lat, lng: place.lng })}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in Maps →
          </a>
        </div>

        {place.external_url && (
          <a
            className="inline-block text-blue-600"
            href={place.external_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Official site →
          </a>
        )}

        <Link href="/" className="block pt-4 text-sm text-neutral-500">
          ← Back to the map
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Gate + manual check**

Run the full gate. Then `npm run dev`: click a card/pin → `/place/<slug>` renders name, why, description, tags, address with a working "Open in Maps" link; an unknown slug (`/place/nope`) shows the not-found page. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: server-rendered place detail page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 12: Verify and deploy

- [ ] **Step 1: Full local gate**

Run:
```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
```
Expected: all pass.

- [ ] **Step 2: Local Workers-runtime check**

Run `npm run preview`, then:
```bash
curl -s localhost:8787/api/places/geojson | python3 -c "import sys,json;print(len(json.load(sys.stdin)['features']),'features')"
curl -s -o /dev/null -w "%{http_code}\n" localhost:8787/place/nasher-sculpture-center
```
Expected: `5 features`, `200`. Open `http://localhost:8787` in a browser and confirm pins + list + a detail page. Stop preview.

- [ ] **Step 3: Wait for CI green on the last push**

Confirm the `CI` run for the latest commit on `main` is green (GitHub Actions API or ask the human).

- [ ] **Step 4: Deploy**

Run:
```bash
npm run deploy
```

- [ ] **Step 5: Verify production**

```bash
curl -s https://designer-tour-guide.sethmthomas89.workers.dev/api/places/geojson \
  | python3 -c "import sys,json;print(len(json.load(sys.stdin)['features']),'features')"
curl -s -o /dev/null -w "%{http_code}\n" \
  https://designer-tour-guide.sethmthomas89.workers.dev/place/perot-museum
```
Expected: `5 features`, `200`. Open the site: pins over Dallas, filter chips work, list toggle works, detail pages render.

- [ ] **Step 6: Update the README**

Add a "Phase 1" line to `README.md` noting the map now shows seeded places, and that migrations live in `supabase/migrations/` (applied by hand via the SQL Editor).

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: note Phase 1 read path in README

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Definition of done

- [ ] `places` / `place_photos` / `places_public` exist in Supabase with RLS; `submitter_email` is unreadable via the anon key
- [ ] 5 Dallas places seeded and visible through `places_public`
- [ ] Production site shows 5 clustered pins over Dallas
- [ ] Tapping a pin opens a preview sheet; "View details" → `/place/[slug]`
- [ ] Category chips filter both map and list; map/list toggle works
- [ ] `/place/[slug]` is server-rendered with correct `<title>`; unknown slug → not-found
- [ ] `/api/places/geojson` returns a 5-feature FeatureCollection with a cache header
- [ ] `npm run lint && npm run typecheck && npm run test:run && npm run build` all pass; CI green on `main`

## Open questions carried to Phase 2 / 3

- Photo upload + a real image pipeline (Phase 2 write path / Phase 3 polish).
- "Near me" sorting with geolocation (Phase 3).
- Custom MapLibre style + suppressing the `us-interstate` sprite warnings (Phase 3).
- OpenGraph preview images per place (Phase 3).
- Moving migrations to `npx supabase db push` once the CLI is set up.
