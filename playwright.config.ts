import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs the real Next.js app in BILLREADY_TEST_MODE: in-memory store, mock Stripe,
 * captured email. No network, no paid APIs, deterministic.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    ...devices["Pixel 7"], // phone-first (Chromium) — test what contractors actually use
  },
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      BILLREADY_TEST_MODE: "1",
      NEXT_PUBLIC_APP_URL: "http://localhost:3100",
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test",
    },
  },
});
