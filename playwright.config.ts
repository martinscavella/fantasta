import { defineConfig } from "@playwright/test";

// App single-user protetta da password (vedi src/proxy.ts). Il flusso e2e
// effettua il login con APP_PASSWORD (env, vedi .env.local) prima di ogni test.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  workers: 1, // stato applicativo condiviso (Blob), i test non sono isolabili in parallelo
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
