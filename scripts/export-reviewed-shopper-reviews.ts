/**
 * Manually export approved first-party visit ratings for review before release.
 * Set THRIFTLY_ADMIN_BASE_URL and REPORTS_ADMIN_TOKEN in the environment, then
 * run: npx tsx scripts/export-reviewed-shopper-reviews.ts
 * This does not publish or commit the artifact.
 */
import {writeFile, rename, unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {PublishedShopperReview} from '@/lib/shopper-reviews';

const MAX_PAGES = 100;
const TIMEOUT_MS = 30_000;
const MAX_PAGE_BYTES = 1024 * 1024;
const validDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const validVisit = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && validDate(value) && new Date(value).toISOString().slice(0, 10) === value;
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value);

/** Whitelist public fields. Queue UUIDs are high-entropy and never leave this export: a domain-separated hash provides stable, opaque deduplication across releases. */
export function toPublishedReviews(records: unknown[]): PublishedShopperReview[] {
  const seen = new Set<string>();
  const result: PublishedShopperReview[] = [];
  for (const value of records) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const review = row.review && typeof row.review === 'object' && !Array.isArray(row.review) ? row.review as Record<string, unknown> : {};
    if (row.status !== 'approved' || row.reason !== 'shopper-review' || row.confirmedVisit !== true || (row.source != null && row.source !== 'thriftly') || !nonempty(row.id) || !nonempty(row.storeId) || seen.has(row.id) || !Number.isInteger(row.rating) || (row.rating as number) < 1 || (row.rating as number) > 5 || !validVisit(row.visitedOn) || row.visitedOn > new Date().toISOString().slice(0, 10) || !validDate(review.at) || Date.parse(review.at) < Date.parse(row.visitedOn)) continue;
    seen.add(row.id);
    const reportId = createHash('sha256').update(`thriftly-public-review-v1:${row.id}`).digest('hex');
    result.push({reportId, storeId: row.storeId, rating: row.rating as number, visitedOn: row.visitedOn, reviewedAt: review.at, status: 'approved', source: 'thriftly'});
  }
  return result.sort((a, b) => a.reportId.localeCompare(b.reportId));
}

export async function fetchApproved(base: string, token: string): Promise<unknown[]> {
  const url = new URL('/api/admin/reports', base);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) || url.username || url.password) throw new Error('Admin URL must use HTTPS except on localhost, with no embedded credentials.');
  const rows: unknown[] = [];
  const cursors = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page++) {
    url.searchParams.set('status', 'approved');
    const response = await fetch(url, {headers: {Authorization: `Bearer ${token}`}, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS)});
    if (!response.ok) throw new Error(`Admin request failed (${response.status}).`);
    if (!response.body) throw new Error('Empty admin response.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PAGE_BYTES) { await reader.cancel(); throw new Error('Admin response exceeded page size limit.'); }
      chunks.push(value);
    }
    const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid admin response.');
    const result = data as Record<string, unknown>;
    if (!Array.isArray(result.reports) || result.reports.length > 25) throw new Error('Invalid admin report page.');
    rows.push(...result.reports);
    if (result.nextCursor == null || result.nextCursor === '') return rows;
    if (typeof result.nextCursor !== 'string' || result.nextCursor.length > 2048 || /[\u0000-\u001f]/.test(result.nextCursor) || cursors.has(result.nextCursor)) throw new Error('Invalid or repeated admin cursor.');
    cursors.add(result.nextCursor);
    url.searchParams.set('cursor', result.nextCursor);
  }
  throw new Error('Pagination limit reached; no export was written.');
}

async function main() {
  if (process.argv.length !== 2) throw new Error('This command takes no arguments. Supply credentials through environment variables.');
  const base = process.env.THRIFTLY_ADMIN_BASE_URL;
  const token = process.env.REPORTS_ADMIN_TOKEN;
  if (!base || !token) throw new Error('Set THRIFTLY_ADMIN_BASE_URL and REPORTS_ADMIN_TOKEN in the environment.');
  const reviews = toPublishedReviews(await fetchApproved(base, token));
  const output = resolve('data/shopper-reviews.json');
  const temp = `${output}.${process.pid}.tmp`;
  try {
    await writeFile(temp, JSON.stringify({schemaVersion: 1, source: 'thriftly', publishedAt: null, reviews}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    await rename(temp, output);
  } finally { await unlink(temp).catch(() => {}); }
  console.log(`Exported ${reviews.length} approved ratings to ${output}. Review the diff before committing or releasing.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main().catch(error => {console.error(error instanceof Error ? error.message : 'Export failed.'); process.exitCode = 1;});
