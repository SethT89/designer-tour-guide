import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental-cache override yet: Phase 0 has no ISR or cached route handlers
// (home page is fully static, /api/health is force-dynamic). Add the R2
// incremental cache when the first revalidated page or cached handler lands.
export default defineCloudflareConfig({});
