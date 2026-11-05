import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "https://127.0.0.1:3107",
    geolocation: { latitude: 32.84, longitude: -117.27 },
    permissions: ["geolocation"],
    trace: "retain-on-failure",
    ignoreHTTPSErrors: true, // Only the generated local test certificate.
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
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "safari", use: { ...devices["Desktop Safari"] } },
    { name: "iphone", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    // Use an isolated port and always launch this checkout’s production build.
    command: "npm run build && node scripts/test-server.mjs",
    url: "https://127.0.0.1:3107",
    reuseExistingServer: false,
    ignoreHTTPSErrors: true,
    timeout: 600_000,
  },
});
