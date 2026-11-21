import {test as base, expect, type Page, type Response} from "@playwright/test";

// WebKit can report a page loaded (and the network idle) before React has
// hydrated it, so a click lands on a button with no handler yet, or a client
// navigation starts against a half-hydrated document. Every page.goto and
// page.reload in a test's context therefore waits for <html data-hydrated>,
// which components/hydration-marker.tsx sets after hydration.
const patched = new WeakSet<Page>();

async function afterLoad(page: Page, response: Response | null, waitUntil?: string) {
  if (waitUntil === "commit") return response;
  if (response && (response.headers()["content-type"] ?? "").includes("text/html")) {
    await page.locator("html[data-hydrated]").waitFor({state: "attached", timeout: 15_000});
  }
  return response;
}

function waitForHydrationOnLoad(page: Page) {
  if (patched.has(page)) return;
  patched.add(page);
  const goto = page.goto.bind(page);
  const reload = page.reload.bind(page);
  page.goto = async (url, options) => afterLoad(page, await goto(url, options), options?.waitUntil);
  page.reload = async (options) => afterLoad(page, await reload(options), options?.waitUntil);
}

export const test = base.extend({
  context: async ({context}, provide) => {
    context.on("page", waitForHydrationOnLoad);
    context.pages().forEach(waitForHydrationOnLoad);
    await provide(context);
  },
});

export {expect};
