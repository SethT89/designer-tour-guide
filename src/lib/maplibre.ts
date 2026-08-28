import { setWorkerUrl } from "maplibre-gl";

// See scripts/copy-maplibre-worker.mjs for why the worker is vendored into
// public/. This must run once, before the first Map is constructed.
let configured = false;

export function configureMapLibre() {
  if (configured) return;
  setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
  configured = true;
}
