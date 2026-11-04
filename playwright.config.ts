import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3107",
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
    // Use an isolated port and always launch this checkout’s production build.
    command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3107",
    url: "http://127.0.0.1:3107",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
