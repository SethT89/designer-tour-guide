import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": new URL("./src/", import.meta.url).pathname,
      // `server-only` throws outside a React Server Component (incl. Vitest);
      // tests import modules that transitively pull it in.
      "server-only": new URL("./src/test/empty.ts", import.meta.url).pathname,
    },
  },
});
