# Google Maps Link Prefill — Design

**Goal:** On the "add a place" forms, let someone paste a Google Maps link and have the **place name** and **map pin** filled in automatically. The resolved link is stored and shown on the public place page as "View on Google Maps".

**Non-goals:** No Google Places API, no billing, no API key. No address / hours / category / photo import (all require the paid API and carry caching restrictions). No geocode fallback for name-only links — the user taps the map instead.

## Context

- Builds on the Phase 2 write path. The shared `src/components/PlaceForm.tsx` drives the public `/submit` form, the admin "add a place" form (`admin-create`), and the admin edit form (`admin-edit`).
- Mirrors the existing `/api/geocode` pattern: a thin route handler over a pure, unit-tested lib module.
- Migrations: committed `.sql` under `supabase/migrations/`, applied with `npx supabase db push`. Every file starts with `set search_path = public, extensions;`. The `insert_place` / `set_place_point` RPCs and the `places_public` (security-definer) / `places_admin` (`select p.*`) views were added in `0003_write_path.sql`.
- Full gate after each task: `npm run lint && npm run typecheck && npm run test:run && npm run build`.
- Conventional Commits; every commit ends with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

## Components

### 1. `src/lib/google-maps-url.ts` — pure parser

```ts
export function parseGoogleMapsUrl(finalUrl: string): {
  name: string | null;
  lat: number | null;
  lng: number | null;
};
```

No I/O. Handles the common URL shapes:

| Shape | Name from | Coordinates from |
|---|---|---|
| `/maps/place/<Name>/@<lat>,<lng>,<z>z/data=…!3d<lat>!4d<lng>…` | path segment | `!3d…!4d…` preferred, else the `@` viewport centre |
| `/maps/place/<Name>/data=…` (no `@`) | path segment | `!3d…!4d…` |
| `/maps?q=<lat>,<lng>` · `&ll=<lat>,<lng>` · `?q=<Name>` | `q` if non-numeric | `q` / `ll` if a `lat,lng` pair |

Rules:
- Name: take the `/place/<segment>/`, replace `+` with space, `decodeURIComponent`. If the result is empty, looks like a coordinate pair, or matches a Plus Code (`^[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}`), return `null`.
- Coordinates: parse as floats; return `null` unless `lat ∈ [-90, 90]` and `lng ∈ [-180, 180]`.
- Any field that can't be found is `null`. Partial results are valid.

### 2. `src/app/api/resolve-place/route.ts` — resolve + parse

`POST { url: string }` → `200 { name, lat, lng, mapsUrl }` (name/lat/lng each nullable).

1. **Host allowlist.** Parse `url`; proceed only if the host is one of `google.com`, `www.google.com`, `maps.google.com`, `maps.app.goo.gl`, `goo.gl`, `g.co`. Otherwise `400 { error }`.
2. **Resolve redirects.** For any host in the allowlist, `fetch(current, { redirect: "manual" })` and follow the `Location` header up to **5 hops**. Re-check the host allowlist on every hop; a redirect to a non-allowlisted host stops the loop and the last allowlisted URL is used. Only response headers are read, never the body.
3. **Parse** the final URL with `parseGoogleMapsUrl()`.
4. Respond `{ name, lat, lng, mapsUrl: <final resolved URL> }`. If a network or parse step throws, respond `200 { name: null, lat: null, lng: null, mapsUrl: <original url> }` — the client shows "couldn't read that link".

Safety: `wrangler.jsonc` already sets `global_fetch_strictly_public`, so the Worker cannot fetch internal addresses; the host allowlist and 5-hop cap are defence in depth. A 5s timeout via `AbortSignal.timeout(5000)`.

### 3. `src/components/PlaceForm.tsx` — the field

One new optional text input, **"Google Maps link"**, in all three modes, styled like the existing `external_url` field. Its value is submitted as `google_maps_url`.

In `public` and `admin-create` modes only, a **"Fill in"** button sits beside it (same layout as Address → "Find on map"). On click:
- `POST /api/resolve-place` with the field's current value
- Set the field to the returned `mapsUrl`
- If `name` is returned **and the Name field is currently empty** → set Name
- If `lat`/`lng` are returned → set the pin (always, even if it was already set)
- Set a one-line status message (`.label` style, below the field):

| Got | Message |
|---|---|
| name + coords | "Added the name and dropped the pin." |
| coords only | "Dropped the pin — add a name above." |
| name only | "Got the name — tap the map to place the pin." |
| nothing | "Couldn't read that link. Paste a Google Maps place link, or fill the form by hand." |

In `admin-edit` mode the field shows with no button (editing an existing record).

State: `googleMapsUrl` string, `gmBusy` boolean, `gmMsg` string | null. Mirrors the `geo*` trio.

### 4. Validation — `src/lib/place-input.ts`

`parsePlaceInput` gains `google_maps_url`: optional; when non-empty it must parse as a `URL` (reuse the same `normaliseUrl` helper as `external_url`, i.e. prepend `https://` if no scheme). Invalid → `errors.google_maps_url`. The normalised value (or `null`) is added to `PlaceInputValue`.

### 5. Persistence

**`supabase/migrations/0004_google_maps_url.sql`:**
```sql
set search_path = public, extensions;

alter table places add column if not exists google_maps_url text;

-- Re-create insert_place with the new field (same signature, same security-definer setup).
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
(`places_admin` is `select p.*, …` so it picks the column up with no change.)

**Threading `google_maps_url` through the existing field lists:**
- `PlaceFormValues` type + `initial` prefill in `PlaceForm`
- `FIELDS` array in `src/app/api/submit/route.ts`
- `FIELDS` array in `src/app/admin/actions.ts`; add to the `updatePlace` update patch
- `COLUMNS` + `AdminPlace` type in `src/lib/admin/places.ts`
- `COLUMNS` + `PlacePublic` type in `src/lib/places.ts` / `src/lib/types.ts`
- `/api/submit` and `createPlaceDirectly` already spread `...value` into the RPC `p` payload, so the new field flows through once it's in `PlaceInputValue`

### 6. Public display — `src/app/place/[slug]/page.tsx`

When `place.google_maps_url` is set, render a "View on Google Maps →" link in the same block as the existing "Official site →" link (`target="_blank"`, `rel="noopener noreferrer"`, vermilion `.label` style). Both links show if both are present.

No change to the preview sheet, list, `geojson.ts`, or the GeoJSON route.

## Data flow

```
paste link → [Fill in] → POST /api/resolve-place
                           → host allowlist check
                           → follow redirects (≤5 hops, re-check host)
                           → parseGoogleMapsUrl(finalUrl)
                           ← { name, lat, lng, mapsUrl }
        → PlaceForm sets link field = mapsUrl, Name (if empty), pin
        → user finishes form, submits
             → parsePlaceInput validates google_maps_url
             → insert_place RPC / updatePlace writes places.google_maps_url
        → /place/[slug] shows "View on Google Maps →"
```

## Error handling

| Situation | Behaviour |
|---|---|
| Non-Google host pasted | `/api/resolve-place` → `400`; form shows "Couldn't read that link…" |
| Google link, no coords parseable | name filled if present; status "tap the map to place the pin" |
| Short-link resolution network error / timeout | `200` with all-null + original url; status "Couldn't read that link…" |
| `google_maps_url` fails URL validation on submit | field error under the input; submit blocked (same as `external_url`) |
| Field left empty | stored as `NULL`; no link on the public page |

## Testing

| File | Covers |
|---|---|
| `src/lib/google-maps-url.test.ts` | parser: `/place/@…!3d!4d`, `/place/data=` (no `@`), `?q=lat,lng`, `&ll=`, `?q=Name`, Plus-Code name → null, out-of-range coords → null, name percent-decoding |
| `src/app/api/resolve-place/route.test.ts` | mocked `fetch`: non-Google host → 400; single + multi-hop redirect resolves to final URL; redirect to non-Google host stops at last good URL; network throw → 200 all-null |
| `src/lib/place-input.test.ts` | add: valid `google_maps_url` normalised; invalid → error; empty → `null` |
| `src/app/api/submit/route.test.ts` | add `google_maps_url` to the happy-path RPC payload assertion |
| `src/app/admin/actions.test.ts` | `updatePlace` patch and `createPlaceDirectly` RPC payload include `google_maps_url` |
| `src/lib/places.test.ts` | `COLUMNS` includes `google_maps_url` |

Manual: paste a real `maps.app.goo.gl/…` share link on `/submit` → name + pin fill → submit → publish → `/place/<slug>` shows "View on Google Maps →".

## File summary

| Path | Change |
|---|---|
| `src/lib/google-maps-url.ts` | **new** — `parseGoogleMapsUrl` |
| `src/lib/google-maps-url.test.ts` | **new** |
| `src/app/api/resolve-place/route.ts` | **new** — resolve + parse route |
| `src/app/api/resolve-place/route.test.ts` | **new** |
| `supabase/migrations/0004_google_maps_url.sql` | **new** — column, `insert_place`, `places_public` |
| `src/components/PlaceForm.tsx` | **modify** — link field + "Fill in" button + status |
| `src/lib/place-input.ts` / `.test.ts` | **modify** — validate `google_maps_url` |
| `src/app/api/submit/route.ts` | **modify** — `FIELDS` |
| `src/app/admin/actions.ts` / `.test.ts` | **modify** — `FIELDS`, update patch |
| `src/lib/admin/places.ts` | **modify** — `COLUMNS`, `AdminPlace` |
| `src/lib/places.ts` / `.test.ts` | **modify** — `COLUMNS` |
| `src/lib/types.ts` | **modify** — `PlacePublic.google_maps_url` |
| `src/app/place/[slug]/page.tsx` | **modify** — "View on Google Maps →" link |
| `README.md` | **modify** — note the paste-a-link feature |

## Definition of done

- Pasting a `maps.app.goo.gl` or full `google.com/maps/place/…` link on `/submit` or `/admin/new` fills the name (if empty) and drops the pin; the status line reflects what was found.
- A non-Google or unparseable link never breaks the form — it shows the "couldn't read that link" line.
- `google_maps_url` is validated, stored, and rendered as "View on Google Maps →" on the public place page.
- `parsePlaceInput`, `/api/resolve-place`, and `parseGoogleMapsUrl` are unit-tested; `insert_place` + `places_public` carry the new column.
- `npm run lint && npm run typecheck && npm run test:run && npm run build` pass; CI green; deployed.
