import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  // Axe traversals share a preview process. Keep this suite serial so the
  // aggregate quality gate has the same result as its individual claims.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "VITE_E2E_AUTH=1 npm run build && E2E_DATA_DIR=$(mktemp -d) && DATA_DIR=$E2E_DATA_DIR STATIC_DIR=$PWD/dist PORT=4173 cargo run --release --manifest-path server/Cargo.toml",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI
  }
});
