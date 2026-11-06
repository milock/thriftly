import { chromium, devices } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TARGET_URL = process.env.TARGET_URL ?? 'https://www.thriftly.xyz/search?lat=32.7157&lon=-117.1611&radius=15&brands=independent&label=San+Diego';
const OUTPUT_DIR = path.resolve('outputs');
const mode = process.env.RATING_MODE ?? 'legacy';
const samplesPerProfile = Number(process.env.SAMPLES ?? 10);
const ratingTimeoutMs = Number(process.env.RATING_TIMEOUT_MS ?? 15_000);
const includeSwitchCounts = process.env.COUNT_SWITCH_REQUESTS === '1';

if (!['legacy', 'modern'].includes(mode)) throw new Error('RATING_MODE must be legacy or modern');
if (!Number.isInteger(samplesPerProfile) || samplesPerProfile < 1 || samplesPerProfile > 10) {
  throw new Error('SAMPLES must be an integer from 1 to 10');
}

const profiles = [
  { name: 'desktop', viewport: { width: 1440, height: 1000 }, mobile: false, network: null },
  { name: 'mobile_4g', viewport: { width: 390, height: 844 }, mobile: true, network: { offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8, connectionType: 'cellular4g' } },
];

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.ceil(p * sorted.length) - 1]);
}

function summarize(rows) {
  const nav = rows.map((r) => r.navigationToRatingMs).filter(Number.isFinite);
  const list = rows.map((r) => r.listPaintToRatingMs).filter(Number.isFinite);
  return {
    requested: rows.length,
    ratingLoaded: nav.length,
    ratingTimedOut: rows.length - nav.length,
    navigationToRatingMs: nav.length ? { p50: percentile(nav, 0.5), p95: percentile(nav, 0.95), min: Math.min(...nav), max: Math.max(...nav) } : null,
    listPaintToRatingMs: list.length ? { p50: percentile(list, 0.5), p95: percentile(list, 0.95), min: Math.min(...list), max: Math.max(...list) } : null,
    listPainted: rows.filter((r) => Number.isFinite(r.listPaintMs)).length,
    apiStatusCounts: rows.reduce((acc, row) => {
      for (const [key, count] of Object.entries(row.apiStatusCounts ?? {})) acc[key] = (acc[key] ?? 0) + count;
      return acc;
    }, {}),
    switchStoreDetailsRequestCounts: rows.map((r) => r.switchStoreDetailsRequestCount).filter(Number.isFinite),
  };
}

async function oneSample(browser, profile, sampleNumber) {
  const target = new globalThis.URL(TARGET_URL);
  const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  const context = await browser.newContext({
    viewport: profile.viewport,
    isMobile: profile.mobile,
    hasTouch: profile.mobile,
    deviceScaleFactor: profile.mobile ? 2 : 1,
    ...(isLoopback ? { ignoreHTTPSErrors: true } : {}),
    ...(profile.mobile ? { ...devices['iPhone 13'], viewport: profile.viewport } : {}),
  });
  const page = await context.newPage();
  const apiStatusCounts = {};
  const apiErrorStatuses = {};
  let storeDetailsRequests = 0;
  let switchStartRequests = null;
  let switchTogglesPerformed = 0;
  const requestedIds = [];
  let loadedBeforeSwitch = new Set();

  page.on('response', (response) => {
    let pathname;
    try { pathname = new globalThis.URL(response.url()).pathname; } catch { return; }
    if (pathname.startsWith('/api/')) {
      apiStatusCounts[`${pathname} ${response.status()}`] = (apiStatusCounts[`${pathname} ${response.status()}`] ?? 0) + 1;
      if (response.status() >= 400) apiErrorStatuses[`${pathname} ${response.status()}`] = (apiErrorStatuses[`${pathname} ${response.status()}`] ?? 0) + 1;
    }
  });
  page.on('request', (request) => {
    try { if (new globalThis.URL(request.url()).pathname === '/api/store-details') { storeDetailsRequests += 1; requestedIds.push(JSON.parse(request.postData() ?? '{}').storeId); } } catch { /* ignore malformed URLs */ }
  });

  await page.addInitScript(() => {
    window.__ratingLoadEvents = [];
    window.__firstVisibleRating = null;
    window.__firstListPaint = null;
    let queued = false;
    const inspect = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const text = document.body?.innerText ?? '';
        if (window.__firstListPaint === null && /\b\d+ stores ranked near\b/i.test(text)) window.__firstListPaint = performance.now();
        if (window.__firstVisibleRating !== null) return;
        const visible = [...document.querySelectorAll('[data-google-rating][data-state="loaded"]')].some(el => {
          const box = el.getBoundingClientRect(), style = getComputedStyle(el);
          return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth && style.visibility !== 'hidden' && style.display !== 'none';
        });
        if (visible) window.__firstVisibleRating = performance.now();
      });
    };
    new MutationObserver(inspect).observe(document, {subtree:true, childList:true, attributes:true});
    document.addEventListener('DOMContentLoaded', inspect, {once:true});
    document.addEventListener('gmp-load', (event) => {
      window.__ratingLoadEvents.push({ at: performance.now(), target: event.target?.tagName ?? '' });
    }, true);
  });

  if (profile.network) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', profile.network);
  }

  let navigationStatus = null;
  let listPaintMs = null;
  let ratingAtMs = null;
  let ratingSignal = null;
  let error = null;

  try {
    const response = await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    navigationStatus = response?.status() ?? null;

    const listPaintDeadline = Date.now() + 30_000;
    let emptyStateSeen = false;
    while (Date.now() < listPaintDeadline) {
      listPaintMs = await page.evaluate(() => {
        const text = document.body?.innerText ?? '';
        if (/\b\d+ stores ranked near\b/i.test(text)) return window.__firstListPaint ?? performance.now();
        if (/no stores in range/i.test(text)) return -1;
        return null;
      });
      if (listPaintMs !== null && listPaintMs >= 0) break;
      if (listPaintMs === -1) emptyStateSeen = true;
      listPaintMs = null;
      await page.waitForTimeout(100);
    }
    if (listPaintMs === null && emptyStateSeen) listPaintMs = -1;

    const deadline = Date.now() + ratingTimeoutMs;
    while (Date.now() < deadline) {
      const state = await page.evaluate((currentMode) => {
        const visible = (el) => {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        };
        if (currentMode === 'modern') {
          if (window.__firstVisibleRating !== null) return {ready:true, signal:'paint frame with visible server/client rating', at:window.__firstVisibleRating};
          const rows = [...document.querySelectorAll('[data-google-rating][data-state="loaded"]')].filter(visible);
          return rows.length ? { ready: true, signal: 'data-google-rating:loaded', at: performance.now() } : { ready: false };
        }
        const events = window.__ratingLoadEvents ?? [];
        const components = [...document.querySelectorAll('gmp-place-details-compact')].filter(visible);
        const event = events.find((item) => item.target === 'GMP-PLACE-DETAILS-COMPACT');
        return event && components.length
          ? { ready: true, signal: 'gmp-load on visible gmp-place-details-compact', at: event.at }
          : { ready: false };
      }, mode);
      if (state.ready) {
        ratingAtMs = state.at;
        ratingSignal = state.signal;
        break;
      }
      await page.waitForTimeout(100);
    }

    if (includeSwitchCounts && profile.mobile && listPaintMs !== null && listPaintMs >= 0) {
      await page.waitForFunction(() => document.querySelectorAll('[data-google-rating]').length > 0 && !document.querySelector('[data-google-rating][data-state="queued"], [data-google-rating][data-state="loading"]'), {timeout:10000});
      loadedBeforeSwitch = new Set(await page.locator('[data-google-rating][data-state="loaded"]').evaluateAll(rows => rows.map(row => row.closest('[data-store-id]')?.getAttribute('data-store-id')).filter(Boolean)));
      switchStartRequests = storeDetailsRequests;
      for (const label of ['Map', 'List', 'Map', 'List']) {
        const tab = page.getByRole('tab', { name: label, exact: true }).first();
        if (await tab.count()) {
          try {
            await tab.click({ timeout: 5_000 });
            switchTogglesPerformed += 1;
            await page.waitForTimeout(1_000);
          } catch {
            // Leave the completed-click count visible so failed interactions are not mistaken for coverage.
          }
        }
      }
    }
  } catch (caught) {
    error = String(caught?.message ?? caught).slice(0, 240);
  }

  const listPaintDelta = Number.isFinite(listPaintMs) && listPaintMs >= 0 && Number.isFinite(ratingAtMs) ? Math.round(ratingAtMs - listPaintMs) : null;
  const navToRating = Number.isFinite(ratingAtMs) ? Math.round(ratingAtMs) : null;
  const result = {
    profile: profile.name,
    sample: sampleNumber,
    navigationStatus,
    listPaintMs: Number.isFinite(listPaintMs) && listPaintMs >= 0 ? Math.round(listPaintMs) : null,
    listState: listPaintMs === -1 ? 'empty' : Number.isFinite(listPaintMs) ? 'painted' : 'not_painted',
    navigationToRatingMs: navToRating,
    listPaintToRatingMs: listPaintDelta,
    ratingSignal,
    ratingTimedOut: ratingAtMs === null,
    ratingTimeoutMs: ratingAtMs === null ? ratingTimeoutMs : null,
    apiStatusCounts,
    apiErrorStatuses,
    ...(switchStartRequests === null ? {} : {
      switchTogglesPerformed,
      switchStoreDetailsRequestCount: switchTogglesPerformed === 4 ? storeDetailsRequests - switchStartRequests : null,
      alreadyLoadedIdsBeforeSwitch: loadedBeforeSwitch.size,
      duplicateLoadedStoreRequestCount: switchTogglesPerformed === 4 ? requestedIds.slice(switchStartRequests).filter(id => loadedBeforeSwitch.has(id)).length : null,
    }),
    ...(error ? { error } : {}),
  };
  await context.close();
  return result;
}

await mkdir(OUTPUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const startedAt = new Date().toISOString();
const results = [];
try {
  for (const profile of profiles) {
    for (let sample = 1; sample <= samplesPerProfile; sample += 1) {
      const result = await oneSample(browser, profile, sample);
      results.push(result);
      console.log(`${profile.name} ${sample}/${samplesPerProfile}: list=${result.listState}, rating=${result.navigationToRatingMs ?? `timeout/${ratingTimeoutMs}ms`}`);
    }
  }
} finally {
  await browser.close();
}

const report = {
  schemaVersion: 1,
  mode,
  target: TARGET_URL,
  startedAt,
  completedAt: new Date().toISOString(),
  concurrency: 1,
  samplesPerProfile,
  ratingTimeoutMs,
  ratingReadyDefinition: mode === 'legacy'
    ? 'First captured gmp-load event targeting a visible gmp-place-details-compact element.'
    : 'First visible [data-google-rating][data-state="loaded"] element.',
  privacy: 'No response bodies, review text, request query strings, or API keys are stored.',
  profiles: Object.fromEntries(profiles.map((profile) => [profile.name, summarize(results.filter((row) => row.profile === profile.name))])),
  results,
};
const jsonPath = path.join(OUTPUT_DIR, `rating-latency-${mode === 'legacy' ? 'baseline' : 'candidate'}.json`);
const mdPath = path.join(OUTPUT_DIR, `rating-latency-${mode === 'legacy' ? 'baseline' : 'candidate'}.md`);
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const lines = [
  `# Google rating latency ${mode === 'legacy' ? 'baseline' : 'candidate'}`,
  '',
  `- URL: ${TARGET_URL}`,
  `- Started: ${startedAt}`,
  `- Completed: ${report.completedAt}`,
  `- Samples: ${samplesPerProfile} per profile, serial concurrency 1`,
  `- Readiness: ${report.ratingReadyDefinition}`,
  '',
  '| Profile | Loaded | Timed out | Nav to rating p50 | Nav to rating p95 | List paint to rating p50 | List paint to rating p95 | API status counts |',
  '|---|---:|---:|---:|---:|---:|---:|---|',
];
for (const [name, summary] of Object.entries(report.profiles)) {
  lines.push(`| ${name} | ${summary.ratingLoaded}/${summary.requested} | ${summary.ratingTimedOut} | ${summary.navigationToRatingMs?.p50 ?? 'n/a'} | ${summary.navigationToRatingMs?.p95 ?? 'n/a'} | ${summary.listPaintToRatingMs?.p50 ?? 'n/a'} | ${summary.listPaintToRatingMs?.p95 ?? 'n/a'} | ${JSON.stringify(summary.apiStatusCounts)} |`);
}
lines.push('', 'Timeouts are censored observations, not successful latency measurements. Only loaded samples contribute to p50/p95.', '', 'Per-sample timings, statuses, and counts are in the JSON file. No response bodies, review text, request query strings, or API keys were stored.');
if (includeSwitchCounts) {
  lines.push('', '| Profile | /api/store-details calls across mobile list/map switches |', '|---|---:|');
  for (const [name, summary] of Object.entries(report.profiles)) {
    if (summary.switchStoreDetailsRequestCounts.length) {
      lines.push(`| ${name} | ${summary.switchStoreDetailsRequestCounts.join(', ')} |`);
    }
  }
}
await writeFile(mdPath, `${lines.join('\n')}\n`);
console.log(`Saved ${jsonPath} and ${mdPath}`);
