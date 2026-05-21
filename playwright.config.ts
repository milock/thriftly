import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    geolocation: { latitude: 32.84, longitude: -117.27 },
    permissions: ["geolocation"],
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      // Pixel 7 is a Chromium device (mobile viewport + touch) — avoids needing WebKit.
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    // Test the production build, not the dev server: prebuilt routes serve
    // instantly with no per-request Turbopack compile, which is what made the
    // first /search hit time out under parallel workers. Reuses a server
    // already on :3000 locally (e.g. `npm run dev`) for fast iteration.
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
