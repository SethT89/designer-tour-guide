// maplibre-gl v6 ships its web worker as an ESM module that imports a sibling
// `maplibre-gl-shared.mjs`. Bundlers (webpack, Turbopack) do not emit those as
// adjacent static assets, so the worker fails to load and vector tiles never
// render. We copy both files verbatim into `public/vendor/maplibre/` and point
// maplibre at them with `setWorkerUrl()` (see src/lib/maplibre.ts).
//
// Runs on `postinstall` and before `dev` / `build` / `deploy`, always copying
// from the installed package so the vendored copy never drifts from the version
// in package-lock.json. `public/vendor/maplibre/` is gitignored.

import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = dirname(require.resolve("maplibre-gl/package.json")) + "/dist";
const destDir = join(root, "public", "vendor", "maplibre");

const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

await mkdir(destDir, { recursive: true });
for (const file of FILES) {
  await copyFile(join(srcDir, file), join(destDir, file));
  console.log(`copied ${file} -> public/vendor/maplibre/`);
}
