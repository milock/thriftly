// Capture interactive states (popovers, mobile sheet) for design review.
import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3000";
mkdirSync("screenshots", { recursive: true });
const geo = { geolocation: { latitude: 32.84, longitude: -117.27 }, permissions: ["geolocation"] };
const b = await chromium.launch();

async function ready(p) {
  await p.waitForSelector('svg[aria-label^="Goods score"]', { timeout: 55000 }).catch(() => {});
  await p.waitForTimeout(2500);
}

// Desktop: methodology + hours popovers
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, ...geo });
  const p = await ctx.newPage();
  await p.goto(BASE + "/app", { waitUntil: "domcontentloaded", timeout: 60000 });
  await ready(p);
  await p.getByRole("button", { name: /how scoring works/i }).click().catch(() => {});
  await p.waitForTimeout(600);
  await p.screenshot({ path: "screenshots/s-methodology.png" });
  await p.keyboard.press("Escape").catch(() => {});
  await p.waitForTimeout(300);
  await p.getByRole("button", { name: /^hours$/i }).first().click().catch(() => {});
  await p.waitForTimeout(500);
  await p.screenshot({ path: "screenshots/s-hours.png" });
  await ctx.close();
  console.log("  s-methodology, s-hours");
}

// Mobile: filter sheet
{
  const ctx = await b.newContext({ ...devices["Pixel 7"], ...geo });
  const p = await ctx.newPage();
  await p.goto(BASE + "/app", { waitUntil: "domcontentloaded", timeout: 60000 });
  await ready(p);
  await p.getByRole("button", { name: /^filters$/i }).click().catch(() => {});
  await p.waitForTimeout(700);
  await p.screenshot({ path: "screenshots/s-filter-sheet.png" });
  await ctx.close();
  console.log("  s-filter-sheet");
}

await b.close();
console.log("states done");
