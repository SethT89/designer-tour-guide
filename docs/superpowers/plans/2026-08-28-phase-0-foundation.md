# Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Designer Map project skeleton — a Next.js app deployed to Cloudflare Workers that renders a full-screen MapLibre map of Dallas, backed by a Supabase project, with CI and a keep-alive cron.

**Architecture:** Next.js (App Router, TypeScript) built for Cloudflare Workers via the OpenNext adapter. MapLibre GL renders an OpenFreeMap basemap in a client component. Supabase (Postgres) is reachable from server code through a service-role admin client and from the browser through an anon client; a `/api/health` route exercises the DB connection and doubles as the keep-alive target. GitHub Actions runs lint/typecheck/test/build on every push and pings `/api/health` weekly so the free-tier Supabase project never pauses.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, MapLibre GL JS, OpenFreeMap, `@opennextjs/cloudflare` v1 (supports `next >=16.3.3`), Wrangler v4, Supabase (`@supabase/supabase-js`), Vitest + Testing Library, GitHub Actions.

**Execution note (2026-08-28):** `create-next-app` rejects `.` as target because the
parent directory name `Designer_Map` has capitals. Workaround used: scaffold into a
`designer-tour-guide/` subdir, then `rsync -a designer-tour-guide/ ./ && rm -rf
designer-tour-guide`. The scaffold's own `git init` + "Initial commit from Create Next
App" moved up with it, so the repo root is now the project root on branch `main`.
Scaffold also created `AGENTS.md` (auto-managed by `next dev`) and `CLAUDE.md`
(`@AGENTS.md`) — keep and commit both.

---

## Context for the implementer

- The working directory `/Users/seththomas/Desktop/Claude_Projects/Designer_Map` already contains `docs/` (the spec and this plan) and `.superpowers/` (brainstorm scratch). Neither conflicts with `create-next-app`. Everything else in this plan is new.
- Design spec: `docs/superpowers/specs/2026-08-28-designer-map-design.md`. Read it before starting.
- Package manager is **npm** (v11, Node v24). There is no `pnpm`, `gh`, `wrangler`, or `supabase` CLI installed — use `npx` for Wrangler and OpenNext; the GitHub repo is created by the human in the browser.
- Two steps require a human (creating the GitHub repo, `npx wrangler login`, creating the Supabase project, copying dashboard keys). They are called out with **HUMAN STEP** and the agent must stop and wait.
- Conventional Commit messages. Every commit ends with:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```
- Dallas map defaults: longitude `-96.7970`, latitude `32.7767`, zoom `11`.
- GitHub repo name is `designer-tour-guide`. It appears as the repo URL, the `wrangler.jsonc` `name`, the `WORKER_SELF_REFERENCE` service binding, and the deployed Worker URL (`https://designer-tour-guide.<subdomain>.workers.dev`).

## File structure (created by this plan)

| Path | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs` | Scaffold config (from `create-next-app`, then edited) |
| `.gitignore` | Ignore `node_modules`, `.next`, `.open-next`, `.env.local`, `.dev.vars` |
| `.env` | **Committed.** Public-safe build-time vars (`NEXT_PUBLIC_*`) |
| `.env.local` | **Gitignored.** The one true secret: `SUPABASE_SERVICE_ROLE_KEY` |
| `.env.example` | Documents every variable |
| `.dev.vars` | **Gitignored.** `NEXTJS_ENV=development` for `wrangler` preview |
| `src/lib/config.ts` | Parses map/city config from env into typed values with Dallas fallbacks |
| `src/lib/config.test.ts` | Tests for `config.ts` |
| `src/lib/supabase/client.ts` | Browser anon Supabase client |
| `src/lib/supabase/admin.ts` | Server-only service-role Supabase client |
| `src/components/BaseMap.tsx` | `'use client'` MapLibre map component |
| `src/components/BaseMap.test.tsx` | Tests for `BaseMap` (maplibre-gl mocked) |
| `src/app/page.tsx` | Home page — renders `BaseMap` full-screen |
| `src/app/layout.tsx` | Root layout (from scaffold, trimmed) |
| `src/app/globals.css` | Global styles + `maplibre-gl` CSS import |
| `src/app/api/health/route.ts` | DB health check / keep-alive target |
| `src/app/api/health/route.test.ts` | Tests for the health route |
| `wrangler.jsonc` | Cloudflare Worker config |
| `open-next.config.ts` | OpenNext Cloudflare adapter config |
| `public/_headers` | Long-cache headers for `/_next/static/*` |
| `vitest.config.ts`, `vitest.setup.ts` | Test runner config |
| `.github/workflows/ci.yml` | Lint / typecheck / test / build on push + PR |
| `.github/workflows/keepalive.yml` | Weekly ping to `/api/health` |
| `README.md` | Project overview, setup, env var reference |

---

## Task 1: Scaffold the Next.js app

**Files:**
- Create: entire Next.js scaffold in the project root
- Modify: `.gitignore`

- [ ] **Step 1: Run create-next-app in place**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
```
When prompted "directory is not empty, continue?" answer **yes** (only `docs/` and `.superpowers/` are present; they do not conflict).
Expected: scaffold completes, `npm install` runs, `package.json` / `src/app/` / `next.config.ts` exist.

- [ ] **Step 2: Verify the dev server boots**

Run:
```bash
npm run dev
```
Expected: `Ready in ...` and a local URL. Open it, confirm the Next.js welcome page renders. Stop the server (Ctrl-C).

- [ ] **Step 3: Verify a production build succeeds**

Run:
```bash
npm run build
```
Expected: `Compiled successfully`, route table printed, exit code 0.

- [ ] **Step 4: Verify lint passes**

Run:
```bash
npm run lint
```
Expected: `✔ No ESLint warnings or errors` (exit code 0).

- [ ] **Step 5: Add a typecheck script**

In `package.json`, add to `"scripts"`:
```json
"typecheck": "tsc --noEmit"
```

- [ ] **Step 6: Verify typecheck passes**

Run:
```bash
npm run typecheck
```
Expected: no output, exit code 0.

- [ ] **Step 7: Fix .gitignore for env handling**

The scaffold's `.gitignore` contains `.env*`, which would ignore the `.env` file the
plan needs committed. Replace that single `.env*` line with explicit rules, and append
the rest:
```
# env — commit .env and .env.example, ignore anything *.local and .dev.vars
.env*.local
.env.local
.dev.vars

# cloudflare / opennext
.open-next
.wrangler

# superpowers scratch
.superpowers/
```
Verify: `git check-ignore .env` prints nothing (not ignored); `git check-ignore .env.local` prints `.env.local` (ignored).

- [ ] **Step 8: Initialise git and make the first commit**

Run:
```bash
git init
git add -A
git commit -m "$(cat <<'EOF'
chore: scaffold Next.js app with TypeScript and Tailwind

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
Expected: commit created on branch `main` (run `git branch -M main` first if the default branch is `master`).

---

## Task 2: Push to GitHub

**Files:** none (remote setup only)

- [ ] **Step 1: HUMAN STEP — create the empty repo**

Ask the human to:
1. Go to https://github.com/new
2. Repository name: `designer-tour-guide`
3. Visibility: their choice (Private is fine)
4. **Do not** add a README, `.gitignore`, or license (the repo must be empty)
5. Click "Create repository"
6. Confirm to the agent that the repo exists

Wait for the human's confirmation before continuing.

SSH is already configured on this machine (authenticated as GitHub user `SethT89`),
so the remote uses the SSH URL.

- [ ] **Step 2: Add the remote and push**

Run:
```bash
git remote add origin git@github.com:SethT89/designer-tour-guide.git
git branch -M main
git push -u origin main
```
Expected: objects enumerated and written, `branch 'main' set up to track 'origin/main'`.

- [ ] **Step 3: Verify on the web**

Ask the human to reload the repo page and confirm the source files are visible. Do not proceed until confirmed.

---

## Task 3: Set up Vitest and Testing Library

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`, `src/lib/sanity.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Install test dependencies**

Run:
```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3: Create `vitest.setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add test scripts to `package.json`**

In `"scripts"`:
```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 5: Write a sanity test**

Create `src/lib/sanity.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("test harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run the tests**

Run:
```bash
npm run test:run
```
Expected: `1 passed`, exit code 0.

- [ ] **Step 7: Confirm the build ignores test files**

Run:
```bash
npm run build
```
Expected: still succeeds. (Next.js ignores `*.test.ts` by default; if the build tries to compile them, add `"exclude"` for `src/**/*.test.*` to `tsconfig.json` and re-run.)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
test: add Vitest and Testing Library setup

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 4: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:run
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder-anon-key
          NEXT_PUBLIC_MAP_CENTER_LNG: "-96.7970"
          NEXT_PUBLIC_MAP_CENTER_LAT: "32.7767"
          NEXT_PUBLIC_MAP_ZOOM: "11"
          NEXT_PUBLIC_DEFAULT_CITY: Dallas
```
(The `env:` block lets the build run before the real `.env` exists — it is added in Task 5. Once `.env` is committed these are redundant but harmless; leave them so CI never depends on committed secrets.)

- [ ] **Step 2: Commit and push**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci: run lint, typecheck, test, and build on push and PR

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

- [ ] **Step 3: Verify the run is green**

Ask the human to open the repo's **Actions** tab and confirm the `CI` run for the latest commit succeeded. If it fails, read the failing step's log, fix, commit, push, repeat.

---

## Task 5: MapLibre base map of Dallas

**Files:**
- Create: `src/lib/config.ts`, `src/lib/config.test.ts`, `src/components/BaseMap.tsx`, `src/components/BaseMap.test.tsx`, `src/lib/maplibre.ts`, `scripts/copy-maplibre-worker.mjs`, `.env`, `.env.example`
- Modify: `src/app/page.tsx`, `src/app/globals.css`, `src/app/layout.tsx`, `package.json`, `eslint.config.mjs`

**Execution notes (2026-08-28) — maplibre-gl v6 integration:**
1. **No default export.** v6 is ESM-only with named exports. Use
   `import { Map as MapLibreMap, NavigationControl, setWorkerUrl } from "maplibre-gl"`,
   not `import maplibregl from "maplibre-gl"`. The `BaseMap.test.tsx` mock must be a
   flat object (no `default:` key) and include `setWorkerUrl: vi.fn()`.
2. **Web worker must be vendored.** v6 loads its worker as an ESM module that
   imports a sibling `maplibre-gl-shared.mjs`; neither Turbopack nor webpack emits
   those next to the app bundle, so the worker 404s and only raster tiles render
   (vector tiles are parsed in the worker). v6 also removed the old CSP single-file
   worker. Fix: `scripts/copy-maplibre-worker.mjs` copies
   `maplibre-gl-worker.mjs` + `maplibre-gl-shared.mjs` from `node_modules` into
   `public/vendor/maplibre/` (gitignored), wired to `postinstall` / `predev` /
   `prebuild`; `src/lib/maplibre.ts` calls
   `setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs")` once, and `BaseMap`
   calls `configureMapLibre()` before constructing the map. OpenNext's
   `deploy` / `preview` scripts (Task 7) must run the copy script explicitly since
   they bypass npm's `prebuild` hook.
3. **ESLint.** Add `"public/**"` to `globalIgnores` in `eslint.config.mjs` or the
   minified vendored bundle produces ~1000 warnings.
4. **Turbopack stays the default** (`next dev` / `next build` unchanged) — the
   worker issue is bundler-independent and the vendoring fix resolves it for both.
5. **Benign console noise:** OpenFreeMap's Liberty style logs
   `Image "us-interstate_N" could not be loaded` — cosmetic, addressed by a custom
   style in Phase 3.

- [ ] **Step 1: Install MapLibre**

Run:
```bash
npm install maplibre-gl
```

- [ ] **Step 2: Write the failing test for `config.ts`**

Create `src/lib/config.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMapConfig } from "./config";

const ENV_KEYS = [
  "NEXT_PUBLIC_MAP_CENTER_LNG",
  "NEXT_PUBLIC_MAP_CENTER_LAT",
  "NEXT_PUBLIC_MAP_ZOOM",
  "NEXT_PUBLIC_DEFAULT_CITY",
] as const;

// getMapConfig reads process.env on every call, so no module-cache juggling is
// needed — just save and restore the four keys around each test.
describe("getMapConfig", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("falls back to Dallas when env is unset", () => {
    const c = getMapConfig();
    expect(c.center).toEqual([-96.797, 32.7767]);
    expect(c.zoom).toBe(11);
    expect(c.city).toBe("Dallas");
  });

  it("reads values from env", () => {
    process.env.NEXT_PUBLIC_MAP_CENTER_LNG = "2.3522";
    process.env.NEXT_PUBLIC_MAP_CENTER_LAT = "48.8566";
    process.env.NEXT_PUBLIC_MAP_ZOOM = "13";
    process.env.NEXT_PUBLIC_DEFAULT_CITY = "Paris";
    const c = getMapConfig();
    expect(c.center).toEqual([2.3522, 48.8566]);
    expect(c.zoom).toBe(13);
    expect(c.city).toBe("Paris");
  });
});
```

- [ ] **Step 3: Run it, expect failure**

Run:
```bash
npm run test:run -- src/lib/config.test.ts
```
Expected: FAIL — `Cannot find module './config'`.

- [ ] **Step 4: Implement `config.ts`**

Create `src/lib/config.ts`:
```typescript
export type MapConfig = {
  center: [number, number];
  zoom: number;
  city: string;
  styleUrl: string;
};

const DALLAS: Omit<MapConfig, "styleUrl"> = {
  center: [-96.797, 32.7767],
  zoom: 11,
  city: "Dallas",
};

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getMapConfig(): MapConfig {
  return {
    center: [
      num(process.env.NEXT_PUBLIC_MAP_CENTER_LNG, DALLAS.center[0]),
      num(process.env.NEXT_PUBLIC_MAP_CENTER_LAT, DALLAS.center[1]),
    ],
    zoom: num(process.env.NEXT_PUBLIC_MAP_ZOOM, DALLAS.zoom),
    city: process.env.NEXT_PUBLIC_DEFAULT_CITY || DALLAS.city,
    styleUrl: "https://tiles.openfreemap.org/styles/liberty",
  };
}
```

- [ ] **Step 5: Run the test, expect pass**

Run:
```bash
npm run test:run -- src/lib/config.test.ts
```
Expected: `2 passed`.

- [ ] **Step 6: Write the failing test for `BaseMap`**

Create `src/components/BaseMap.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const mapCtor = vi.fn();
const addControl = vi.fn();
const remove = vi.fn();

vi.mock("maplibre-gl", () => ({
  default: {
    Map: class {
      constructor(opts: unknown) {
        mapCtor(opts);
      }
      addControl = addControl;
      remove = remove;
      on = vi.fn();
    },
    NavigationControl: class {},
  },
}));

beforeEach(() => {
  mapCtor.mockClear();
  addControl.mockClear();
  remove.mockClear();
});

import { BaseMap } from "./BaseMap";

describe("BaseMap", () => {
  it("renders a map container", () => {
    const { container } = render(<BaseMap />);
    expect(container.querySelector("[data-testid='base-map']")).not.toBeNull();
  });

  it("initialises MapLibre with the Dallas config", () => {
    render(<BaseMap />);
    expect(mapCtor).toHaveBeenCalledTimes(1);
    const opts = mapCtor.mock.calls[0][0] as {
      center: [number, number];
      zoom: number;
      style: string;
    };
    expect(opts.center).toEqual([-96.797, 32.7767]);
    expect(opts.zoom).toBe(11);
    expect(opts.style).toBe("https://tiles.openfreemap.org/styles/liberty");
  });

  it("tears down the map on unmount", () => {
    const { unmount } = render(<BaseMap />);
    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 7: Run it, expect failure**

Run:
```bash
npm run test:run -- src/components/BaseMap.test.tsx
```
Expected: FAIL — `Cannot find module './BaseMap'`.

- [ ] **Step 8: Implement `BaseMap.tsx`**

Create `src/components/BaseMap.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { getMapConfig } from "@/lib/config";

export function BaseMap() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const { center, zoom, styleUrl } = getMapConfig();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center,
      zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    return () => map.remove();
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid="base-map"
      className="h-dvh w-full"
    />
  );
}
```

- [ ] **Step 9: Run the test, expect pass**

Run:
```bash
npm run test:run -- src/components/BaseMap.test.tsx
```
Expected: `3 passed`.

- [ ] **Step 10: Import MapLibre CSS globally**

At the top of `src/app/globals.css`, add:
```css
@import "maplibre-gl/dist/maplibre-gl.css";
```
(Keep the existing Tailwind directives below it.)

- [ ] **Step 11: Render the map on the home page**

Replace the contents of `src/app/page.tsx` with:
```tsx
import { BaseMap } from "@/components/BaseMap";

export default function Home() {
  return (
    <main className="h-dvh w-full">
      <BaseMap />
    </main>
  );
}
```

- [ ] **Step 12: Trim the root layout**

In `src/app/layout.tsx`, set the metadata and ensure the body has no default margin:
```tsx
export const metadata = {
  title: "Designer Map",
  description: "A curated map of places designers will love.",
};
```
Leave the font setup from the scaffold. Ensure `<body>` className includes no padding that would inset the map (Tailwind's Preflight already removes body margin).

- [ ] **Step 13: Create `.env` (committed, public-safe values)**

Create `.env`:
```
# Public build-time values. Safe to commit.
# Supabase URL + anon key are protected by Row-Level Security.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_MAP_CENTER_LNG=-96.7970
NEXT_PUBLIC_MAP_CENTER_LAT=32.7767
NEXT_PUBLIC_MAP_ZOOM=11
NEXT_PUBLIC_DEFAULT_CITY=Dallas
```
(The two Supabase values are filled in Task 6.)

- [ ] **Step 14: Create `.env.example`**

Create `.env.example`:
```
# ---- committed in .env (public-safe) ----
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_MAP_CENTER_LNG=-96.7970
NEXT_PUBLIC_MAP_CENTER_LAT=32.7767
NEXT_PUBLIC_MAP_ZOOM=11
NEXT_PUBLIC_DEFAULT_CITY=Dallas

# ---- .env.local only (gitignored, SECRET) ----
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 15: Manual verification**

Run:
```bash
npm run dev
```
Open the local URL. Expected: a full-screen slippy map centered on downtown Dallas, zoom controls top-right, OpenFreeMap attribution bottom-right. Pan/zoom works. Stop the server.

- [ ] **Step 16: Full verification suite**

Run:
```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
```
Expected: all pass.

- [ ] **Step 17: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: render full-screen MapLibre basemap of Dallas

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 6: Supabase project, clients, and health route

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/admin.ts`, `src/app/api/health/route.ts`, `src/app/api/health/route.test.ts`
- Modify: `.env`, `.env.local`

- [ ] **Step 1: HUMAN STEP — create the Supabase project**

Ask the human to:
1. Go to https://supabase.com/dashboard → "New project"
2. Name: `designer-tour-guide`; choose a region close to Dallas (e.g. `us-east-1` or `us-west-1`); set a database password (save it in a password manager)
3. Wait for provisioning to finish
4. Open **Project Settings → API** and copy:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **`anon` `public` key**
   - **`service_role` `secret` key**
5. Paste all three to the agent

Wait for the human's response.

- [ ] **Step 2: Fill in env files**

In `.env`, set:
```
NEXT_PUBLIC_SUPABASE_URL=<Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
```

Create `.env.local` (gitignored):
```
SUPABASE_SERVICE_ROLE_KEY=<service_role secret key>
```

- [ ] **Step 3: Create `.dev.vars` for wrangler preview**

Create `.dev.vars` (gitignored):
```
NEXTJS_ENV=development
SUPABASE_SERVICE_ROLE_KEY=<service_role secret key>
```

- [ ] **Step 4: Install the Supabase SDK**

Run:
```bash
npm install @supabase/supabase-js
```

- [ ] **Step 5: Create the browser client**

Create `src/lib/supabase/client.ts`:
```typescript
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
}

export const supabase = createClient(url, anonKey);
```

- [ ] **Step 6: Create the server admin client**

Create `src/lib/supabase/admin.ts`:
```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

Run:
```bash
npm install -D server-only
```

- [ ] **Step 7: Write the failing test for the health route**

Create `src/app/api/health/route.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc,
  }),
}));

beforeEach(() => rpc.mockReset());

import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns ok when the DB responds", async () => {
    rpc.mockResolvedValue({ data: 1, error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 503 when the DB errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
```

- [ ] **Step 8: Run it, expect failure**

Run:
```bash
npm run test:run -- src/app/api/health/route.test.ts
```
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 9: Implement the health route**

Create `src/app/api/health/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();
    // `select 1` via PostgREST: read zero rows from a guaranteed-present catalog.
    const { error } = await supabase.rpc("now");
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, time: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 10: Create the `now` RPC in Supabase**

Ask the human to run this in the Supabase dashboard → **SQL Editor**:
```sql
create or replace function public.now()
returns timestamptz
language sql
stable
as $$ select now() $$;

grant execute on function public.now() to anon, authenticated, service_role;
```
(This gives the health check a trivial, cheap call that also proves PostgREST + the DB are alive.)

- [ ] **Step 11: Run the test, expect pass**

Run:
```bash
npm run test:run -- src/app/api/health/route.test.ts
```
Expected: `2 passed`.

- [ ] **Step 12: Manual verification against the real DB**

Run `npm run dev`, then in another shell:
```bash
curl -s localhost:3000/api/health
```
Expected: `{"ok":true,"time":"..."}`. Stop the server.

- [ ] **Step 13: Full verification suite**

Run:
```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
```
Expected: all pass.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add Supabase clients and /api/health check

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 7: Deploy to Cloudflare Workers via OpenNext

**Files:**
- Create: `wrangler.jsonc`, `open-next.config.ts`, `public/_headers`
- Modify: `next.config.ts`, `package.json`

- [ ] **Step 1: Install the adapter and Wrangler**

Run:
```bash
npm install @opennextjs/cloudflare@latest
npm install -D wrangler@latest
```

- [ ] **Step 2: Create `wrangler.jsonc`**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "designer-tour-guide",
  "main": ".open-next/worker.js",
  "compatibility_date": "2025-03-01",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "services": [
    { "binding": "WORKER_SELF_REFERENCE", "service": "designer-tour-guide" }
  ],
  "vars": {
    "NEXT_PUBLIC_MAP_CENTER_LNG": "-96.7970",
    "NEXT_PUBLIC_MAP_CENTER_LAT": "32.7767",
    "NEXT_PUBLIC_MAP_ZOOM": "11",
    "NEXT_PUBLIC_DEFAULT_CITY": "Dallas"
  }
}
```
Note: `NEXT_PUBLIC_*` values are inlined at **build** time from `.env`; the `vars` block here is belt-and-suspenders for anything read at runtime. The Supabase URL/anon key come from `.env` at build; the service-role key is set as a secret in Step 8.

- [ ] **Step 3: Create `open-next.config.ts`**

```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
```
(No incremental-cache override for Phase 0 — the app has no ISR pages yet. Revisit in a later phase if cached route handlers are added.)

- [ ] **Step 4: Wire OpenNext into `next.config.ts`**

Edit `next.config.ts` to call the dev shim:
```typescript
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 5: Add `public/_headers`**

Create `public/_headers`:
```
/_next/static/*
  Cache-Control: public,max-age=31536000,immutable
```

- [ ] **Step 6: Add scripts to `package.json`**

In `"scripts"`:
```json
"preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
"deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
"cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
```

- [ ] **Step 7: HUMAN STEP — authenticate Wrangler**

Ask the human to run, in the project directory:
```bash
npx wrangler login
```
This opens a browser OAuth flow. They approve, then return. Confirm `npx wrangler whoami` prints their account.

- [ ] **Step 8: Local preview on the Workers runtime**

Run:
```bash
npm run preview
```
Expected: builds `.open-next/`, starts a local Worker, prints a `http://localhost:8787` (or similar) URL. Open it — the Dallas map must render. `curl http://localhost:8787/api/health` should return `{"ok":true,...}` (it reads `SUPABASE_SERVICE_ROLE_KEY` from `.dev.vars`). Stop it.

- [ ] **Step 9: First deploy**

Run:
```bash
npm run deploy
```
Expected: uploads the Worker, prints the live URL `https://designer-tour-guide.<subdomain>.workers.dev`. Record this URL — it is `WORKER_URL` for the rest of the plan.

- [ ] **Step 10: Set the production secret**

Run:
```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```
Paste the `service_role` key when prompted.

- [ ] **Step 11: Redeploy so the secret takes effect**

Run:
```bash
npm run deploy
```

- [ ] **Step 12: Verify the live deployment**

Run:
```bash
curl -s https://designer-tour-guide.<subdomain>.workers.dev/api/health
```
Expected: `{"ok":true,"time":"..."}`.
Open the Worker URL in a browser: the Dallas map renders full-screen.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
build: deploy to Cloudflare Workers via OpenNext adapter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

- [ ] **Step 14: Verify CI still passes**

The `_headers` file and new deps must not break the build job. Confirm the Actions run for this commit is green (ask the human to check, or wait for the notification). Fix forward if red.

---

## Task 8: Supabase keep-alive cron

**Files:**
- Create: `.github/workflows/keepalive.yml`

- [ ] **Step 1: HUMAN STEP — store the Worker URL as a repo variable**

Ask the human to go to the repo → **Settings → Secrets and variables → Actions → Variables → New repository variable**:
- Name: `WORKER_URL`
- Value: `https://designer-tour-guide.<subdomain>.workers.dev` (no trailing slash)

- [ ] **Step 2: Write the workflow**

Create `.github/workflows/keepalive.yml`:
```yaml
name: Supabase keep-alive

on:
  schedule:
    - cron: "17 14 * * 1" # 14:17 UTC every Monday
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Hit the health endpoint
        run: |
          set -euo pipefail
          url="${{ vars.WORKER_URL }}/api/health"
          echo "GET $url"
          body="$(curl -sS --fail --max-time 30 "$url")"
          echo "$body"
          echo "$body" | grep -q '"ok":true'
```

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/keepalive.yml
git commit -m "$(cat <<'EOF'
ci: weekly keep-alive ping to prevent Supabase free-tier pause

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

- [ ] **Step 4: Trigger it manually to verify**

Ask the human to open the repo → **Actions → Supabase keep-alive → Run workflow** (on `main`). Confirm the run succeeds and the log shows `"ok":true`.

---

## Task 9: README and env documentation

**Files:**
- Create/replace: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Designer Map

A crowdsourced, editorially-curated map of tourist locations designers will love —
architecture, interiors, signage, furniture, public art, galleries, well-designed shops.
Anyone can submit a place; the curator approves before it appears on the map.

- **Design spec:** [docs/superpowers/specs/2026-08-28-designer-map-design.md](docs/superpowers/specs/2026-08-28-designer-map-design.md)
- **Phase plans:** [docs/superpowers/plans/](docs/superpowers/plans/)

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Hosting | Cloudflare Workers via OpenNext |
| Database / Auth | Supabase (Postgres + PostGIS) |
| Basemap | MapLibre GL + OpenFreeMap |
| Tests | Vitest + Testing Library |
| CI | GitHub Actions |

## Local development

```bash
npm install
cp .env.example .env.local   # then fill SUPABASE_SERVICE_ROLE_KEY
# .env already holds the public NEXT_PUBLIC_* values
npm run dev                  # http://localhost:3000
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run test` / `npm run test:run` | Vitest (watch / once) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Next.js production build |
| `npm run preview` | Build + run on the local Workers runtime |
| `npm run deploy` | Build + deploy to Cloudflare Workers |

## Environment variables

| Variable | Where | Secret? | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env` | No | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env` | No | Protected by RLS |
| `NEXT_PUBLIC_MAP_CENTER_LNG/LAT` | `.env` | No | Default map center (Dallas) |
| `NEXT_PUBLIC_MAP_ZOOM` | `.env` | No | Default zoom |
| `NEXT_PUBLIC_DEFAULT_CITY` | `.env` | No | Display name |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` + `wrangler secret` | **Yes** | Server-only; never `NEXT_PUBLIC` |

## Deployment

Push to `main` runs CI. Deploys are manual: `npm run deploy`.
A weekly GitHub Action pings `/api/health` to keep the free-tier Supabase project active.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: add project README

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Definition of done

- [ ] `https://designer-tour-guide.<subdomain>.workers.dev` renders a full-screen MapLibre map of Dallas
- [ ] `GET /api/health` on the live URL returns `{"ok":true,...}`
- [ ] `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` all pass locally
- [ ] CI is green on `main`
- [ ] The keep-alive workflow has succeeded at least once (manual trigger)
- [ ] `README.md` documents setup and every env var
- [ ] Repo pushed to GitHub with all commits

## Open questions carried forward (not blocking Phase 0)

- Custom OpenFreeMap/MapLibre style (deferred to Phase 3 per spec).
- Whether to add a custom domain now or after MVP (after — `workers.dev` is fine for Phases 0–2).
- Incremental-cache override for OpenNext — add when the first cached route handler or ISR page lands.
