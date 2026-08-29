# Designer Map

A crowdsourced, editorially-curated map of tourist locations designers will love —
architecture, interiors, signage, furniture, public art, galleries, well-designed
shops. Anyone can submit a place; the curator approves it before it appears on the
map.

- **Design spec:** [docs/superpowers/specs/2026-08-28-designer-map-design.md](docs/superpowers/specs/2026-08-28-designer-map-design.md)
- **Phase plans:** [docs/superpowers/plans/](docs/superpowers/plans/)
- **Live:** https://designer-tour-guide.sethmthomas89.workers.dev

## Status

- **Phase 0** — foundation: Next.js on Cloudflare Workers, Supabase, MapLibre basemap, CI.
- **Phase 1** — read path: `places` schema + PostGIS + RLS, five seeded Dallas
  landmarks, clustered map with a tap-to-preview bottom sheet, a map/list toggle,
  category filter chips, and server-rendered `/place/[slug]` pages.
- **Phase 2** — write path: public `/submit` form (honeypot + 5/hour per-IP KV
  rate limit) creates `pending` places with photos; a magic-link-authenticated
  `/admin` dashboard (gated by `ADMIN_EMAIL` in `proxy.ts` and re-checked in every
  server action) reviews the queue, publishes / rejects / edits, lists published
  places, and adds places directly. Photos upload to a public Supabase Storage
  bucket and show on the map preview, list, and detail page. Submitters can paste
  a Google Maps link on the add-a-place forms to prefill the name and pin — no
  Google API; the link is parsed and short links are resolved server-side
  (`/api/resolve-place`), then stored and shown as "View on Google Maps" on the
  place page.

Database migrations live in [`supabase/migrations/`](supabase/migrations/) and are
applied with `npx supabase db push` (project linked via the Supabase CLI). Each
file starts with `set search_path = public, extensions;` for PostGIS.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Hosting | Cloudflare Workers via OpenNext |
| Database / Auth | Supabase (Postgres + PostGIS) |
| Basemap | MapLibre GL v6 + OpenFreeMap |
| Tests | Vitest + Testing Library |
| CI | GitHub Actions |

## Local development

```bash
npm install
cp .env.example .env.local    # paste SUPABASE_SERVICE_ROLE_KEY + set ADMIN_EMAIL
# .env already holds the public NEXT_PUBLIC_* values
npm run dev                   # http://localhost:3000
```

For the `/admin` magic-link login to work, the Supabase project's
**Authentication → URL Configuration** must list the site URL and allow
`http://localhost:3000/**` and the production `…workers.dev/**` as redirect URLs.

`npm install` runs `scripts/copy-maplibre-worker.mjs` (postinstall), which vendors
MapLibre's web worker into `public/vendor/maplibre/` (gitignored). Without it the
basemap renders no vector tiles — see the script header for why.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run test` / `npm run test:run` | Vitest (watch / once) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen && tsc --noEmit` |
| `npm run build` | Next.js production build |
| `npm run preview` | Build + run on the local Workers runtime (port 8787) |
| `npm run deploy` | Build + deploy to Cloudflare Workers |

## Environment variables

| Variable | Where | Secret? | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env` | No | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env` | No | Protected by RLS |
| `NEXT_PUBLIC_MAP_CENTER_LNG` / `_LAT` | `.env` | No | Default map center (Dallas) |
| `NEXT_PUBLIC_MAP_ZOOM` | `.env` | No | Default zoom |
| `NEXT_PUBLIC_DEFAULT_CITY` | `.env` | No | Display name |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` + `.dev.vars` locally; `wrangler secret` in prod | **Yes** | Server-only; never `NEXT_PUBLIC` |
| `ADMIN_EMAIL` | `.env.local` locally; `wrangler.jsonc` `vars` in prod | No | The one email allowed into `/admin`. Read server-side; not `NEXT_PUBLIC` |
| `NEXT_PUBLIC_SITE_URL` | `.env` (prod URL); `.env.local` overrides to `http://localhost:3000` | No | Magic-link `emailRedirectTo` base; inlined at build |
| `RATE_LIMIT` (KV) | `wrangler.jsonc` `kv_namespaces` | No | Workers KV namespace for the submission rate limit |

## Deployment

Every push to `main` runs CI (lint, typecheck, test, build). Deploys are manual:

```bash
npm run deploy
```

Production secrets are set once with `npx wrangler secret put <NAME>`. A weekly
GitHub Action (`.github/workflows/keepalive.yml`) pings `/api/health` so the
free-tier Supabase project never pauses.

## Notes

- **Lockfile:** regenerate with a full `rm -rf node_modules package-lock.json &&
  npm install` rather than incremental `npm install <pkg>` — incremental installs
  have left `package-lock.json` in a state that `npm ci` rejects on Linux CI.
- The OpenFreeMap Liberty style logs harmless `Image "us-interstate_N" could not be
  loaded` warnings; a custom style in Phase 3 removes them.
