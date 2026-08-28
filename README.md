# Designer Map

A crowdsourced, editorially-curated map of tourist locations designers will love —
architecture, interiors, signage, furniture, public art, galleries, well-designed
shops. Anyone can submit a place; the curator approves it before it appears on the
map.

- **Design spec:** [docs/superpowers/specs/2026-08-28-designer-map-design.md](docs/superpowers/specs/2026-08-28-designer-map-design.md)
- **Phase plans:** [docs/superpowers/plans/](docs/superpowers/plans/)
- **Live:** https://designer-tour-guide.sethmthomas89.workers.dev

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
cp .env.example .env.local    # then paste SUPABASE_SERVICE_ROLE_KEY into .env.local
# .env already holds the public NEXT_PUBLIC_* values
npm run dev                   # http://localhost:3000
```

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
