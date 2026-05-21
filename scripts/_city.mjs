import { chromium } from "@playwright/test";
const b = await chromium.launch();
for (const scheme of ["light","dark"]) {
  const ctx = await b.newContext({ viewport:{width:1100,height:1000}, deviceScaleFactor:2, colorScheme:scheme });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3000/goodwill/san-diego-ca", { waitUntil:"domcontentloaded", timeout:60000 });
  await p.waitForTimeout(2500);
  await p.evaluate(() => window.scrollTo(0, 360));
  await p.waitForTimeout(800);
  await p.screenshot({ path:`screenshots/city-list-${scheme}.png` });
  await ctx.close();
}
await b.close(); console.log("city list shots done");
