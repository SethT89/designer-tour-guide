# Google Maps Link Prefill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the "add a place" forms, paste a Google Maps link → the place name and map pin fill in; the resolved link is stored and shown on the public place page.

**Architecture:** A pure parser (`src/lib/google-maps-url.ts`) extracts name + coordinates from a Google Maps URL. A thin route (`/api/resolve-place`) follows Google short-link redirects server-side, then calls the parser. `PlaceForm` gains a "Google Maps link" field with a "Fill in" button that calls the route and applies the results. A new nullable `places.google_maps_url` column stores the link; the public place page renders "View on Google Maps →".

**Tech Stack:** Next.js 16 (route handlers), Supabase (Postgres, `insert_place` RPC + `places_public` view), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-28-google-maps-link-prefill-design.md`

---

## Context for the implementer

- Shared form is `src/components/PlaceForm.tsx` (`"use client"`), used by `/submit` (public), `/admin/new` (`admin-create`), `/admin/[id]/edit` (`admin-edit`).
- `/api/geocode/route.ts` is the reference pattern: thin route over a pure lib module.
- Migrations: committed `.sql` in `supabase/migrations/`, applied with `npx supabase db push` (project linked). **Every file starts with `set search_path = public, extensions;`**. `insert_place` and `places_public` were defined in `0001` / `0003`.
- Route tests that build `FormData` with a `File` need `// @vitest-environment node` at the top (jsdom's Blob polyfill deadlocks `Request.formData()`); tests that only read query params or JSON bodies don't.
- `vi.hoisted(() => ({ ... }))` is required when a `vi.mock` factory references test-local mock fns (hoisting).
- Full gate after each task: `npm run lint && npm run typecheck && npm run test:run && npm run build`.
- Conventional Commits; every commit ends with:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```

## File structure

| Path | Responsibility |
|---|---|
| `src/lib/google-maps-url.ts` | Pure `parseGoogleMapsUrl(url)` → `{ name, lat, lng }` |
| `src/lib/google-maps-url.test.ts` | Parser unit tests |
| `src/app/api/resolve-place/route.ts` | POST route: host allowlist, redirect resolution, parse |
| `src/app/api/resolve-place/route.test.ts` | Route unit tests (mocked fetch) |
| `supabase/migrations/0004_google_maps_url.sql` | `google_maps_url` column, `insert_place` + `places_public` re-create |
| `src/lib/place-input.ts` / `.test.ts` | Validate/normalise `google_maps_url` |
| `src/lib/types.ts` | `PlacePublic.google_maps_url` |
| `src/lib/places.ts` / `.test.ts` | `COLUMNS` gains `google_maps_url` |
| `src/lib/admin/places.ts` | `COLUMNS` + `AdminPlace` gain `google_maps_url` |
| `src/app/api/submit/route.ts` | `FIELDS` gains `google_maps_url` |
| `src/app/admin/actions.ts` / `.test.ts` | `FIELDS` + `updatePlace` patch gain `google_maps_url` |
| `src/components/PlaceForm.tsx` | Link field, "Fill in" button, status line |
| `src/app/place/[slug]/page.tsx` | "View on Google Maps →" link |
| `README.md` | Note the feature |

---

## Task 1: `parseGoogleMapsUrl`

**Files:**
- Create: `src/lib/google-maps-url.ts`
- Create: `src/lib/google-maps-url.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/google-maps-url.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseGoogleMapsUrl } from "./google-maps-url";

describe("parseGoogleMapsUrl", () => {
  it("reads name and the precise !3d!4d coords from a place URL", () => {
    const r = parseGoogleMapsUrl(
      "https://www.google.com/maps/place/Nasher+Sculpture+Center/@32.7876813,-96.8022944,17z/data=!3m1!4b1!4m6!3m5!1s0x864e99:0x8f!8m2!3d32.7876813!4d-96.8001057!16s%2Fg%2F123",
    );
    expect(r.name).toBe("Nasher Sculpture Center");
    expect(r.lat).toBeCloseTo(32.7876813);
    expect(r.lng).toBeCloseTo(-96.8001057);
  });

  it("falls back to the @ viewport centre when there is no !3d!4d", () => {
    const r = parseGoogleMapsUrl(
      "https://www.google.com/maps/place/Perot+Museum/@32.7869,-96.8064,17z/",
    );
    expect(r.name).toBe("Perot Museum");
    expect(r.lat).toBeCloseTo(32.7869);
    expect(r.lng).toBeCloseTo(-96.8064);
  });

  it("percent-decodes the name", () => {
    const r = parseGoogleMapsUrl(
      "https://www.google.com/maps/place/Caf%C3%A9+Brazil/@32.8,-96.7,17z/",
    );
    expect(r.name).toBe("Café Brazil");
  });

  it("reads a q=lat,lng pin", () => {
    const r = parseGoogleMapsUrl("https://maps.google.com/?q=32.78,-96.80");
    expect(r.name).toBeNull();
    expect(r.lat).toBeCloseTo(32.78);
    expect(r.lng).toBeCloseTo(-96.8);
  });

  it("reads an ll=lat,lng pin and a q= name", () => {
    const r = parseGoogleMapsUrl(
      "https://maps.google.com/?q=Nasher+Sculpture+Center&ll=32.7876,-96.8001",
    );
    expect(r.name).toBe("Nasher Sculpture Center");
    expect(r.lat).toBeCloseTo(32.7876);
    expect(r.lng).toBeCloseTo(-96.8001);
  });

  it("rejects a Plus Code as a name", () => {
    const r = parseGoogleMapsUrl(
      "https://www.google.com/maps/place/QXW6%2B39+Dallas/@32.78,-96.8,17z/",
    );
    expect(r.name).toBeNull();
  });

  it("rejects out-of-range coordinates", () => {
    const r = parseGoogleMapsUrl(
      "https://www.google.com/maps/place/X/@999,-96.8,17z/",
    );
    expect(r.lat).toBeNull();
    expect(r.lng).toBeNull();
  });

  it("returns all-null for a non-maps URL", () => {
    const r = parseGoogleMapsUrl("https://example.com/");
    expect(r).toEqual({ name: null, lat: null, lng: null });
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npm run test:run -- src/lib/google-maps-url.test.ts`
Expected: FAIL — `parseGoogleMapsUrl` is not exported.

- [ ] **Step 3: Implement**

`src/lib/google-maps-url.ts`:
```ts
export type ParsedMapsUrl = {
  name: string | null;
  lat: number | null;
  lng: number | null;
};

const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}/i;

function coord(n: number, min: number, max: number): number | null {
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function cleanName(raw: string | undefined): string | null {
  if (!raw) return null;
  let name: string;
  try {
    name = decodeURIComponent(raw.replace(/\+/g, " ")).trim();
  } catch {
    return null;
  }
  if (!name) return null;
  if (PLUS_CODE.test(name)) return null;
  // A bare "lat,lng" dropped-pin segment is not a name.
  if (/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(name)) return null;
  return name;
}

export function parseGoogleMapsUrl(url: string): ParsedMapsUrl {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { name: null, lat: null, lng: null };
  }

  let name: string | null = null;
  let lat: number | null = null;
  let lng: number | null = null;

  // /maps/place/<Name>/...
  const placeMatch = u.pathname.match(/\/maps\/place\/([^/]+)/);
  if (placeMatch) name = cleanName(placeMatch[1]);

  // Precise place location: ...!3d<lat>!4d<lng>...
  const d = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (d) {
    lat = coord(parseFloat(d[1]), -90, 90);
    lng = coord(parseFloat(d[2]), -180, 180);
  }

  // Viewport centre: @<lat>,<lng>,<zoom>z
  if (lat === null || lng === null) {
    const at = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (at) {
      lat = coord(parseFloat(at[1]), -90, 90);
      lng = coord(parseFloat(at[2]), -180, 180);
    }
  }

  // ?q= / ?ll= / &ll=
  const q = u.searchParams.get("q");
  const ll = u.searchParams.get("ll");
  const pair = (s: string | null) =>
    s && /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(s.trim())
      ? (s.trim().split(",").map(Number) as [number, number])
      : null;

  const llPair = pair(ll) ?? pair(q);
  if ((lat === null || lng === null) && llPair) {
    lat = coord(llPair[0], -90, 90);
    lng = coord(llPair[1], -180, 180);
  }
  if (!name && q && !pair(q)) name = cleanName(q);

  return { name, lat, lng };
}
```

- [ ] **Step 4: Run it, expect pass**

Run: `npm run test:run -- src/lib/google-maps-url.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Gate + commit**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add src/lib/google-maps-url.ts src/lib/google-maps-url.test.ts
git commit -m "$(cat <<'EOF'
feat: parse name and coordinates from a Google Maps URL

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `/api/resolve-place`

**Files:**
- Create: `src/app/api/resolve-place/route.ts`
- Create: `src/app/api/resolve-place/route.test.ts`

- [ ] **Step 1: Write the failing test**

`src/app/api/resolve-place/route.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { POST } from "./route";

function post(url: unknown) {
  return new Request("http://localhost/api/resolve-place", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("POST /api/resolve-place", () => {
  it("400s a non-Google host", async () => {
    const res = await POST(post("https://evil.example.com/maps/place/X"));
    expect(res.status).toBe(400);
  });

  it("parses a full Google Maps place URL without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(
      post(
        "https://www.google.com/maps/place/Nasher/@32.78,-96.80,17z/data=!8m2!3d32.7876!4d-96.8001",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Nasher");
    expect(body.lat).toBeCloseTo(32.7876);
    expect(body.lng).toBeCloseTo(-96.8001);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("follows short-link redirects then parses the final URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://maps.google.com/maps?q=32.78,-96.80" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(post("https://maps.app.goo.gl/abc123"));
    const body = await res.json();
    expect(body.lat).toBeCloseTo(32.78);
    expect(body.lng).toBeCloseTo(-96.8);
    expect(body.mapsUrl).toBe("https://maps.google.com/maps?q=32.78,-96.80");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops following when a redirect leaves the allowlist", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.example.com/" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(post("https://maps.app.goo.gl/abc123"));
    const body = await res.json();
    expect(body.mapsUrl).toBe("https://maps.app.goo.gl/abc123");
    expect(body.lat).toBeNull();
  });

  it("returns all-null on a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("boom")),
    );
    const res = await POST(post("https://maps.app.goo.gl/abc123"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      name: null,
      lat: null,
      lng: null,
      mapsUrl: "https://maps.app.goo.gl/abc123",
    });
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npm run test:run -- src/app/api/resolve-place/route.test.ts`
Expected: FAIL — `POST` not exported.

- [ ] **Step 3: Implement**

`src/app/api/resolve-place/route.ts`:
```ts
import { NextResponse } from "next/server";
import { parseGoogleMapsUrl } from "@/lib/google-maps-url";

// Full Maps URLs are parsed directly; only these hosts are followed as redirects.
const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "g.co"]);
const ALLOWED_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "maps.google.com",
  ...SHORT_HOSTS,
]);

const MAX_HOPS = 5;

function host(raw: string): string | null {
  try {
    return new URL(raw).host;
  } catch {
    return null;
  }
}

function hostAllowed(raw: string): boolean {
  const h = host(raw);
  return h !== null && ALLOWED_HOSTS.has(h);
}

/**
 * Follow Location headers for short-link hosts until a real Google Maps URL is
 * reached. Every hop must stay on an allowlisted host or resolution stops.
 */
async function resolve(url: string): Promise<string> {
  let current = url;
  for (let i = 0; i < MAX_HOPS; i++) {
    const h = host(current);
    if (h === null || !SHORT_HOSTS.has(h)) return current;
    const res = await fetch(current, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    if (res.status < 300 || res.status >= 400) return current;
    const location = res.headers.get("location");
    if (!location) return current;
    const next = new URL(location, current).toString();
    if (!hostAllowed(next)) return current;
    current = next;
  }
  return current;
}

export async function POST(request: Request) {
  let url: string;
  try {
    url = String((await request.json()).url ?? "").trim();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!hostAllowed(url)) {
    return NextResponse.json(
      { error: "Paste a Google Maps link." },
      { status: 400 },
    );
  }

  let mapsUrl: string;
  try {
    mapsUrl = await resolve(url);
  } catch {
    return NextResponse.json({ name: null, lat: null, lng: null, mapsUrl: url });
  }

  const { name, lat, lng } = parseGoogleMapsUrl(mapsUrl);
  return NextResponse.json({ name, lat, lng, mapsUrl });
}
```

- [ ] **Step 4: Run it, expect pass**

Run: `npm run test:run -- src/app/api/resolve-place/route.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Gate + commit**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add src/app/api/resolve-place/
git commit -m "$(cat <<'EOF'
feat: /api/resolve-place resolves Google short links and parses them

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Migration `0004` — `google_maps_url` column

**Files:**
- Create: `supabase/migrations/0004_google_maps_url.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/0004_google_maps_url.sql`:
```sql
set search_path = public, extensions;

alter table places add column if not exists google_maps_url text;

-- Re-create insert_place with the new field (same signature).
create or replace function public.insert_place(
  p jsonb, p_lng double precision, p_lat double precision
) returns uuid language plpgsql security definer as $$
declare new_id uuid;
begin
  insert into places (
    name, slug, description, why, category, tags, address, city, country,
    external_url, google_maps_url, status, submitter_email, submitter_note,
    published_at, location
  )
  values (
    p->>'name', p->>'slug', coalesce(p->>'description',''), coalesce(p->>'why',''),
    (p->>'category')::place_category,
    coalesce((select array_agg(x) from jsonb_array_elements_text(p->'tags') x), '{}'),
    coalesce(p->>'address',''), coalesce(p->>'city',''), coalesce(p->>'country',''),
    nullif(p->>'external_url',''), nullif(p->>'google_maps_url',''),
    (p->>'status')::place_status,
    nullif(p->>'submitter_email',''), nullif(p->>'submitter_note',''),
    case when (p->>'published_at') is not null then now() else null end,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  )
  returning id into new_id;
  return new_id;
end $$;
revoke all on function public.insert_place(jsonb, double precision, double precision)
  from anon, authenticated;

-- Re-create places_public with the new column.
drop view if exists places_public;
create view places_public as
select
  p.id, p.name, p.slug, p.description, p.why, p.category, p.tags,
  st_x(p.location::geometry) as lng,
  st_y(p.location::geometry) as lat,
  p.address, p.city, p.country, p.external_url, p.google_maps_url, p.published_at,
  coalesce((
    select json_agg(json_build_object(
      'storage_path', ph.storage_path, 'credit', ph.credit,
      'alt', ph.alt, 'sort_order', ph.sort_order
    ) order by ph.sort_order)
    from place_photos ph where ph.place_id = p.id
  ), '[]'::json) as photos
from places p
where p.status = 'published';
grant select on places_public to anon, authenticated;
```

- [ ] **Step 2: Apply + verify**

```bash
npx supabase db push
```
Expected: `Applying migration 0004_google_maps_url.sql...` then `Finished supabase db push.` with no error.

Verify the column exists (anon read of the view still works, and the new key is present):
```bash
KEY=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env | cut -d= -f2-)
curl -s "https://hrovkahgsbiygaymeovu.supabase.co/rest/v1/places_public?select=slug,google_maps_url&limit=1" -H "apikey: $KEY" -H "authorization: Bearer $KEY"
```
Expected: a JSON array; each row object has a `google_maps_url` key (value `null` for existing rows).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_google_maps_url.sql
git commit -m "$(cat <<'EOF'
feat(db): places.google_maps_url column

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Validate `google_maps_url` in `parsePlaceInput`

**Files:**
- Modify: `src/lib/place-input.ts`
- Modify: `src/lib/place-input.test.ts`

- [ ] **Step 1: Add failing tests**

In `src/lib/place-input.test.ts`, inside `describe("parsePlaceInput", …)`, add:
```ts
  it("normalises a google_maps_url and defaults it to null", () => {
    const withLink = parsePlaceInput({
      ...ok,
      google_maps_url: "maps.app.goo.gl/abc123",
    });
    expect(withLink.ok && withLink.value.google_maps_url).toBe(
      "https://maps.app.goo.gl/abc123",
    );
    const without = parsePlaceInput(ok);
    expect(without.ok && without.value.google_maps_url).toBeNull();
  });

  it("rejects an invalid google_maps_url", () => {
    const r = parsePlaceInput({ ...ok, google_maps_url: "http://" });
    expect(r.ok).toBe(false);
  });
```

- [ ] **Step 2: Run, expect failure**

Run: `npm run test:run -- src/lib/place-input.test.ts`
Expected: FAIL — `value.google_maps_url` is `undefined`.

- [ ] **Step 3: Implement**

In `src/lib/place-input.ts`:

Add to the `PlaceInputValue` type after `external_url`:
```ts
  google_maps_url: string | null;
```

In `parsePlaceInput`, after the `external_url` block:
```ts
  const google_maps_url = normaliseUrl(raw.google_maps_url ?? "");
  if (google_maps_url === undefined)
    errors.google_maps_url = "Not a valid URL.";
```

In the returned `value` object, after `external_url: external_url ?? null,`:
```ts
      google_maps_url: google_maps_url ?? null,
```

- [ ] **Step 4: Run, expect pass**

Run: `npm run test:run -- src/lib/place-input.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate + commit**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add src/lib/place-input.ts src/lib/place-input.test.ts
git commit -m "$(cat <<'EOF'
feat: validate google_maps_url in parsePlaceInput

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Thread `google_maps_url` through types, data layer, and write paths

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/places.ts`, `src/lib/places.test.ts`
- Modify: `src/lib/admin/places.ts`
- Modify: `src/app/api/submit/route.ts`
- Modify: `src/app/admin/actions.ts`, `src/app/admin/actions.test.ts`

- [ ] **Step 1: `src/lib/types.ts`**

In the `PlacePublic` type, after `external_url: string | null;` add:
```ts
  google_maps_url: string | null;
```

- [ ] **Step 2: `src/lib/places.ts`**

Change `COLUMNS` to include `google_maps_url` (after `external_url`):
```ts
const COLUMNS =
  "id,name,slug,description,why,category,tags,lng,lat,address,city,country,external_url,google_maps_url,published_at,photos";
```

- [ ] **Step 3: `src/lib/places.test.ts`**

In the fixture `row` object, after `external_url: null,` add:
```ts
  google_maps_url: null,
```

- [ ] **Step 4: `src/lib/admin/places.ts`**

Change `COLUMNS` (after `external_url`):
```ts
const COLUMNS =
  "id,name,slug,description,why,category,tags,lng,lat,address,city,country,external_url,google_maps_url,status,submitter_email,submitter_note,rejection_reason,created_at,published_at";
```

In the `AdminPlace` type, after `external_url: string | null;` add:
```ts
  google_maps_url: string | null;
```

In `src/lib/admin/places.test.ts`, in the `placeRow` fixture, after `external_url: null,` add:
```ts
  google_maps_url: null,
```

- [ ] **Step 5: `src/app/api/submit/route.ts`**

Add `"google_maps_url"` to the `FIELDS` array (after `"external_url"`).

- [ ] **Step 6: `src/app/admin/actions.ts`**

Add `"google_maps_url"` to the `FIELDS` array (after `"external_url"`).

In `updatePlace`, add to the `.update({ ... })` object (after `external_url: v.external_url,`):
```ts
      google_maps_url: v.google_maps_url,
```

- [ ] **Step 7: `src/app/admin/actions.test.ts`**

In the `value` fixture, after `external_url: null,` add:
```ts
  google_maps_url: null,
```

- [ ] **Step 8: Gate + commit**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A
git commit -m "$(cat <<'EOF'
feat: carry google_maps_url through the read and write paths

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `PlaceForm` — link field + "Fill in" button

**Files:**
- Modify: `src/components/PlaceForm.tsx`

- [ ] **Step 1: Type + initial state**

In `PlaceFormValues`, after `external_url: string;` add:
```ts
  google_maps_url: string;
```

After the `externalUrl` state line, add:
```ts
  const [googleMapsUrl, setGoogleMapsUrl] = useState(
    initial?.google_maps_url ?? "",
  );
  const [gmBusy, setGmBusy] = useState(false);
  const [gmMsg, setGmMsg] = useState<string | null>(null);
```

- [ ] **Step 2: The resolve handler**

Add near `findOnMap`:
```ts
  async function fillFromLink() {
    const raw = googleMapsUrl.trim();
    if (!raw) return;
    setGmBusy(true);
    setGmMsg(null);
    try {
      const res = await fetch("/api/resolve-place", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: raw }),
      });
      const body = (await res.json()) as {
        name?: string | null;
        lat?: number | null;
        lng?: number | null;
        mapsUrl?: string;
        error?: string;
      };
      if (!res.ok) {
        setGmMsg(
          body.error ??
            "Couldn't read that link. Paste a Google Maps place link.",
        );
        return;
      }
      if (body.mapsUrl) setGoogleMapsUrl(body.mapsUrl);
      const gotName = !!body.name;
      const gotPin = body.lat != null && body.lng != null;
      if (gotName && !name.trim()) setName(body.name!);
      if (gotPin) setPin({ lat: body.lat!, lng: body.lng! });
      setGmMsg(
        gotName && gotPin
          ? "Added the name and dropped the pin."
          : gotPin
            ? "Dropped the pin — add a name above."
            : gotName
              ? "Got the name — tap the map to place the pin."
              : "Couldn't read that link. Paste a Google Maps place link, or fill the form by hand.",
      );
    } catch {
      setGmMsg("Couldn't reach the link resolver. Try again.");
    } finally {
      setGmBusy(false);
    }
  }
```

- [ ] **Step 3: The field**

Immediately **before** the existing `<Field label="Name">` block, add:
```tsx
      <Field label="Google Maps link (optional)">
        <div className="flex gap-2">
          <input
            className={fieldClass}
            value={googleMapsUrl}
            onChange={(e) => setGoogleMapsUrl(e.target.value)}
            inputMode="url"
            placeholder="Paste to prefill the name and pin"
          />
          {mode !== "admin-edit" && (
            <button
              type="button"
              onClick={fillFromLink}
              disabled={gmBusy || !googleMapsUrl.trim()}
              className="label shrink-0 border border-ink px-3 disabled:opacity-40"
            >
              {gmBusy ? "…" : "Fill in"}
            </button>
          )}
        </div>
        {gmMsg && <p className="label mt-2">{gmMsg}</p>}
      </Field>
```

- [ ] **Step 4: Submit payload**

In `onSubmit`, where the other `fd.set(...)` calls are, add:
```ts
    fd.set("google_maps_url", googleMapsUrl);
```

- [ ] **Step 5: Manual smoke (dev)**

```bash
npm run dev
```
On `http://localhost:3000/submit`: paste `https://www.google.com/maps/place/Nasher+Sculpture+Center/@32.7876813,-96.8022944,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d32.7876813!4d-96.8001057` → click "Fill in" → Name fills with "Nasher Sculpture Center", the pin jumps, status reads "Added the name and dropped the pin." Paste `https://example.com` → status reads the "couldn't read that link" message, form unchanged.

- [ ] **Step 6: Gate + commit**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add src/components/PlaceForm.tsx
git commit -m "$(cat <<'EOF'
feat(submit): paste a Google Maps link to prefill name and pin

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Public place page link + edit-form prefill + README

**Files:**
- Modify: `src/app/place/[slug]/page.tsx`
- Modify: `src/app/admin/(protected)/[id]/edit/page.tsx`
- Modify: `README.md`

- [ ] **Step 1: "View on Google Maps →" on the detail page**

In `src/app/place/[slug]/page.tsx`, immediately after the `{place.external_url && ( … )}` block, add:
```tsx
        {place.google_maps_url && (
          <a
            className="label inline-block !text-accent underline decoration-1 underline-offset-4"
            href={place.google_maps_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Google Maps →
          </a>
        )}
```

- [ ] **Step 2: Prefill in the edit form**

In `src/app/admin/(protected)/[id]/edit/page.tsx`, in the `initial` object, after `external_url: place.external_url ?? "",` add:
```ts
    google_maps_url: place.google_maps_url ?? "",
```

- [ ] **Step 3: README**

In `README.md`, under the Phase 2 bullet (or a new sub-bullet), add:
```
- Submitters can paste a Google Maps link on the add-a-place forms to prefill
  the name and pin; the link is stored and shown as "View on Google Maps" on
  the place page. No Google API — the link is parsed and short links are
  resolved server-side (`/api/resolve-place`).
```

- [ ] **Step 4: Gate**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: show "View on Google Maps" on the place page; prefill on edit

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Verify end-to-end and merge

- [ ] **Step 1: Full local gate**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
```

- [ ] **Step 2: Manual end-to-end (dev)**

```bash
npm run dev
```
- `/submit`: paste a real `maps.app.goo.gl/…` share link → "Fill in" → name + pin populate → finish the form → submit → `/submit/thanks`.
- Log in, `/admin` → the submission shows → **Publish**.
- `/place/<slug>` → "View on Google Maps →" link points at the resolved URL and opens Google Maps.
- `/admin/<id>/edit` → the Google Maps link field is prefilled; no "Fill in" button.

- [ ] **Step 3: Merge to main, push, deploy**

```bash
git checkout main
git merge --no-ff google-maps-link-prefill -m "$(cat <<'EOF'
Merge: Google Maps link prefill on the add-a-place forms

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
npm run lint && npm run typecheck && npm run test:run && npm run build
git push
npm run deploy
```

- [ ] **Step 4: Production smoke**

On `https://designer-tour-guide.sethmthomas89.workers.dev/submit`: paste a Google Maps link → "Fill in" → name + pin populate. Confirm `/place/<slug>` for an existing published place still renders (no `google_maps_url` → no extra link, no error).

---

## Definition of done

- [ ] Pasting a Google Maps link (full or `maps.app.goo.gl` short) on `/submit` or `/admin/new` fills the Name (when empty) and drops the pin; the status line reflects what was found.
- [ ] A non-Google or unparseable link shows the "couldn't read that link" line and changes nothing else.
- [ ] `google_maps_url` is validated, stored via `insert_place` / `updatePlace`, exposed by `places_public` + `places_admin`, and shown as "View on Google Maps →" on the public place page.
- [ ] `parseGoogleMapsUrl`, `/api/resolve-place`, and `parsePlaceInput` changes are unit-tested.
- [ ] `npm run lint && npm run typecheck && npm run test:run && npm run build` pass; CI green on `main`; deployed and smoke-tested.

## Notes / carried forward

- Google Places API enrichment (address, hours, category, live photos with attribution) is deliberately out of scope — see the spec's non-goals. If revisited, `/api/resolve-place` already yields the `mapsUrl`; a place ID can be parsed from the `!1s0x…:0x…` segment as the API key into Places Details.
