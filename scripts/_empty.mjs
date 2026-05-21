import { chromium } from "@playwright/test";
const b = await chromium.launch();
for (const scheme of ["light","dark"]) {
  const ctx = await b.newContext({ viewport:{width:1440,height:900}, deviceScaleFactor:2, colorScheme:scheme });
  const p = await ctx.newPage();
  // Remote area (Yellowstone) — no Goodwill in range → empty/nearest state.
  await p.goto("http://localhost:3000/search?lat=44.4280&lon=-110.5885&radius=20&label=Yellowstone%2C+WY", { waitUntil:"domcontentloaded", timeout:60000 });
  await p.waitForTimeout(3500);
  await p.screenshot({ path:`screenshots/empty-${scheme}.png` });
  await ctx.close();
}
await b.close(); console.log("empty-state shots done");
