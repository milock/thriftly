// Dev screenshot helper: capture the landing page + the app across viewports so we
// can eyeball design iterations. Usage: node scripts/shoot.mjs [baseUrl] [tag]
import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3000";
const TAG = process.argv[3] || "v";
mkdirSync("screenshots", { recursive: true });

const SCHEME = process.env.SCHEME === "dark" ? "dark" : "light";
const browser = await chromium.launch();
const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: SCHEME };
const mobile = { ...devices["iPhone 13"], colorScheme: SCHEME };

async function shoot(path, name, ctxOpts, { waitRing = false, tab, fullPage = false } = {}) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (waitRing) {
    await page.waitForSelector('svg[aria-label^="Goods score"]', { timeout: 55000 }).catch(() => {});
  }
  if (tab) {
    await page.getByRole("tab", { name: new RegExp(tab, "i") }).click().catch(() => {});
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(2800);
  await page.screenshot({ path: `screenshots/${TAG}-${name}.png`, fullPage });
  await ctx.close();
  console.log("  " + name);
}

// Landing page
await shoot("/", "lp-desktop", desktop, { waitRing: true });
await shoot("/", "lp-full", desktop, { waitRing: true, fullPage: true });
await shoot("/", "lp-mobile", mobile, { waitRing: true });
// App
await shoot("/app", "app-desktop", desktop, { waitRing: true });
await shoot("/app", "app-mobile", mobile, { waitRing: true });
await shoot("/app", "app-mobile-map", mobile, { waitRing: true, tab: "map" });

await browser.close();
console.log("done:", TAG);
