import { defineConfig } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `rm -rf .e2e && mkdir -p .e2e && npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: "file:./.e2e/e2e.db",
      MOCKABLE_LLM: "mock",
      NEXT_PUBLIC_APP_URL: BASE_URL,
      PORT: String(PORT),
    },
  },
});
