import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Stesso alias di tsconfig: serve ai moduli sotto src/app importati dai test.
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Solo unit test: gli e2e (e2e/*.spec.ts) girano con Playwright (npm run e2e).
    include: ["src/**/*.test.ts"],
  },
});
