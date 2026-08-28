# Designer Map — Design Spec

**Date:** 2026-08-28
**Status:** Approved for planning

## Summary

A crowdsourced, editorially-curated map of tourist locations that designers will
love — striking architecture, interiors, signage, furniture showrooms, public
art, galleries, well-designed shops. Anyone can submit a place through a public
form; nothing appears on the map until the curator approves it. One curator
(the owner) to start, with the door open to city-based editors later.

Primary use cases:

1. **Planning before a trip** — browse a city from home, see what's worth visiting.
2. **Out walking a neighborhood** — "what design-worthy thing is near me right now?"

## Scope

### In scope (MVP)

- Public map view + list view of published places
- Server-rendered place detail pages (shareable links)
- Category filtering
- Public submission form (anonymous, no account)
- Admin review queue (approve / reject / edit-then-publish)
- Admin "add place directly" tool for seeding
- Admin authentication (single user, magic link)
- "Near me" sorting when the visitor grants location
- Custom map styling
- Basic spam control (rate limit, honeypot, upload limits)

### Explicitly out of scope (later)

- User accounts for the public
- Saved lists / personal collections (may add browser-local lists later)
- Multiple publishers / city editors (data model leaves room; no UI/roles in MVP)
- Offline map caching
- Discipline-based filtering (graphic vs. industrial vs. architecture) — MVP ships
  simple categories only
- Native mobile app (web app must be architected so a native client can reuse the
  API later; no native build in MVP)
- Hard city restrictions — pins may be created anywhere; the owner seeds one city
  deeply first

## Tech stack

All services run on accounts the owner already has, all on ongoing free tiers that
permit commercial use.

| Layer | Choice | Notes |
|---|---|---|
| Repo + CI | GitHub + GitHub Actions | lint / typecheck / build on PRs |
| Framework | Next.js (App Router, TypeScript) | Server-rendered place pages; API layer a future native app can reuse |
| Deploy adapter | OpenNext | Builds Next.js for Cloudflare Workers |
| Hosting | Cloudflare Workers | Owner's account; unlimited bandwidth on free tier |
| Database | Supabase Postgres + PostGIS | PostGIS powers "near me" radius/sort queries |
| Auth | Supabase Auth (email magic link) | Single hardcoded admin address |
| Photo storage | Supabase Storage | 1 GB free (~1,000+ optimized images); migrate to Cloudflare R2 if it grows |
| Basemap renderer | MapLibre GL JS | Open source, no token, no usage billing |
| Basemap tiles/style | OpenFreeMap | Free, unlimited, no account; style customized by the owner |
| Geocoding (submission form) | Photon (free) or MapTiler free tier | address → coordinates; low volume |
| Keep-alive | GitHub Actions scheduled workflow | Weekly query against Supabase to prevent the 7-day free-tier pause |

Deferred alternatives, should the need arise: Mapbox GL JS (turnkey styling +
geocoding, metered), Cloudflare R2 for images (10 GB free), Supabase Pro ($25/mo).

## Data model

### `places`

A submission and a place are the same row. A submission is a `place` with
`status = 'pending'`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | |
| `slug` | text unique | generated from name + short id; used in `/place/[slug]` |
| `description` | text | general description of the place |
| `why` | text | the designer angle — why it belongs on this map |
| `category` | enum | see category list below |
| `tags` | text[] | free-form, curator-normalized |
| `location` | geography(Point, 4326) | PostGIS; the pin |
| `address` | text | human-readable |
| `city` | text | |
| `country` | text | |
| `external_url` | text nullable | official site, article, etc. |
| `status` | enum | `pending` \| `published` \| `rejected` |
| `submitter_email` | text nullable | server-side only, never exposed publicly |
| `submitter_note` | text nullable | note to curator, never exposed publicly |
| `rejection_reason` | text nullable | internal only |
| `created_at` | timestamptz | |
| `published_at` | timestamptz nullable | |

Categories (MVP enum): `architecture`, `interiors`, `graphic_signage`,
`product_furniture`, `public_art`, `museum_gallery`, `shop`, `other`.

### `place_photos`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `place_id` | uuid FK → places | |
| `storage_path` | text | path in Supabase Storage |
| `credit` | text nullable | photographer / source |
| `alt` | text | accessibility |
| `sort_order` | int | gallery order; 0 = hero |

### Auth

Single admin user via Supabase Auth. No public `users` table beyond what Supabase
manages. One allowed email address, checked in middleware for all `/admin` routes
and privileged API handlers.

### Row-Level Security

- **Anonymous `SELECT`**: only rows where `status = 'published'`. `submitter_email`,
  `submitter_note`, and `rejection_reason` are excluded from every public query
  path (view or explicit column selection, not just RLS).
- **Anonymous `INSERT` into `places`**: allowed, forced to `status = 'pending'`,
  rate-limited (see Non-functionals). No `UPDATE` / `DELETE`.
- **Anonymous `INSERT` into `place_photos`**: allowed only tied to a `pending`
  place created in the same submission transaction/flow.
- **All other reads and writes**: require the authenticated admin session.

## Screens — public

1. **Map view (home, `/`)** — full-screen MapLibre map; published places as pins,
   clustered at low zoom; category filter chips; floating "＋ Add a place" button.
   Tapping a pin opens a bottom-sheet preview: hero photo, name, category,
   "Details" link. Toggle to list view.
2. **List view** — cards for published places; sorted nearest-first when the
   visitor grants geolocation, otherwise grouped by city. Same filter chips.
3. **Place detail (`/place/[slug]`)** — server-rendered for shareable links and
   SEO: photo gallery, name, category + tags, the `why` text, `description`,
   address with "open in maps" link, `external_url`. OpenGraph tags + image.
4. **Submit (`/submit`)** — form fields: name, address (geocode lookup → drops a
   point on a mini-map the user can nudge), category, tags, description, why,
   up to 5 photos, optional email, optional note to curator. On submit → creates
   `pending` place + photos, shows a confirmation screen. Honeypot field included.
5. **About (`/about`)** — what the project is, how curation works, contact.

## Screens — admin (`/admin`, single-user, behind magic-link login)

1. **Review queue** — `pending` places, newest first. Each entry shows all
   submitted fields, photos, and the pin on a map. Actions:
   - **Publish** — sets `status = 'published'`, `published_at = now()`.
   - **Reject** — sets `status = 'rejected'`, optional internal `rejection_reason`.
   - **Edit then publish** — correct text, retag, nudge the pin, crop/reorder
     photos, then publish.
2. **Published places** — searchable list; edit or unpublish (`status` back to
   `pending` or a dedicated `unpublished` — decided in planning) any live place.
3. **Add place directly** — the submit form without the queue; publishes
   immediately. Primary tool for seeding the first city.
4. **Login** — Supabase magic link to the one allowed admin email.

## Non-functionals

- **Mobile-first**: design every screen at 375px width first. Large tap targets,
  bottom sheets, native-feeling map gestures. Mobile is the expected device.
- **Performance**: place list and detail pages server-rendered and cached at the
  Cloudflare edge. Pins delivered as a single lightweight GeoJSON payload,
  clustered client-side at low zoom.
- **Image pipeline**: on upload, resize to a web-max (~1600px) and a thumbnail
  before storing; serve through `next/image`. Enforce max 5 photos, max size per
  photo (exact number set in planning).
- **Spam control**: rate-limit submissions per IP via Cloudflare; honeypot field;
  photo count/size caps. No CAPTCHA in MVP.
- **Privacy**: `submitter_email` and `submitter_note` are stored server-side only
  and never included in any public page, API response, or GeoJSON.
- **SEO / sharing**: per-place OpenGraph tags and preview image so shared links
  render well.
- **Testing**: Vitest for units (slug generation, geocode helper, "near me"
  query builder, RLS policy assumptions). Playwright for two end-to-end flows —
  submit a place, and approve it in admin.
- **API shape**: keep read endpoints (places list, place detail, GeoJSON) as
  clean JSON routes a future native client can consume without change.

## Build phases

Each phase ends deployed and usable.

### Phase 0 — Foundation

GitHub repo; Next.js + TypeScript scaffold; Supabase project created; OpenNext →
Cloudflare Workers deploy working; environment variables and secrets wired
(Supabase URL/keys, admin email); GitHub Actions CI (lint, typecheck, build);
Supabase keep-alive scheduled workflow.

**Deliverable:** deployed page rendering a MapLibre + OpenFreeMap map centered on
the first city.

### Phase 1 — Read path

`places` and `place_photos` schema, PostGIS extension, enums, RLS policies; 3–5
real places seeded via SQL; public map view with clustered GeoJSON pins; list
view; place detail page; category filter chips.

**Deliverable:** a browsable public map of seeded places.

### Phase 2 — Write path

Public submission form with address geocoding, pin-nudge mini-map, and photo
upload; `/admin` magic-link login and route protection; review queue with
publish / reject / edit-then-publish; "add place directly" tool.

**Deliverable:** a place can be submitted by the public and published by the
curator, entirely through the UI.

### Phase 3 — Polish

Custom MapLibre style; "near me" sorting with geolocation; image resize pipeline;
OpenGraph tags + preview images; PWA manifest; submission rate-limiting and
honeypot; Playwright tests for the submit and approve flows.

**Deliverable:** production-ready MVP.

## Open questions for planning

- Exact photo count/size limits.
- "Unpublish" semantics: reuse `pending`, or add an `unpublished` status.
- Geocoder choice: Photon vs. MapTiler free tier (depends on rate limits at
  expected volume).
- Whether Phase 3's PWA manifest is worth including in MVP or deferred.
