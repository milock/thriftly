import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { get, list, put } from '@vercel/blob';

// Server-only module. Clients must use type-only imports from this file.
export const REPORT_REASONS = ['wrong-location', 'donation-only', 'closed', 'duplicate', 'incorrect-hours', 'departments', 'shopper-review', 'other'] as const;
export type ReportReason = typeof REPORT_REASONS[number];
export type ReportStatus = 'pending' | 'approved' | 'rejected';
export interface ReportInput {
  storeId: string;
  reason: ReportReason;
  details: string;
  requestId: string;
  visitedOn: string | null;
  rating: number | null;
  confirmedVisit: boolean;
}
export interface ListingReport {
  version: 1;
  id: string;
  storeId: string;
  reason: ReportReason;
  details: string;
  submittedAt: string;
  visitedOn: string | null;
  rating: number | null;
  confirmedVisit: boolean;
  status: ReportStatus;
  review?: { at: string; actor: string; note: string };
}
export class ReportError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PREFIX = 'reports/v1/';
const MAX_BYTES = 8192;
const MAX_DETAILS = 1500;
const controlCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ReportError(400, 'invalid_report');
  return value as Record<string, unknown>;
}
export function validateReport(value: unknown, knownStoreIds: ReadonlySet<string>, now = new Date()): ReportInput {
  const raw = object(value);
  if (Object.keys(raw).some(key => !['storeId', 'reason', 'details', 'requestId', 'visitedOn', 'rating', 'confirmedVisit'].includes(key))) throw new ReportError(400, 'invalid_report');
  if (typeof raw.storeId !== 'string' || raw.storeId.length > 200 || !knownStoreIds.has(raw.storeId)) throw new ReportError(400, 'unknown_store');
  if (typeof raw.reason !== 'string' || !REPORT_REASONS.includes(raw.reason as ReportReason)) throw new ReportError(400, 'invalid_report');
  if (typeof raw.requestId !== 'string' || !UUID.test(raw.requestId)) throw new ReportError(400, 'invalid_report');
  if (typeof raw.details !== 'string' || raw.details.length > MAX_DETAILS || controlCharacters.test(raw.details)) throw new ReportError(400, 'invalid_report');
  const details = raw.details.trim();
  if (['departments', 'other'].includes(raw.reason) && details.length < 10) throw new ReportError(400, 'details_required');
  const visitedOn = raw.visitedOn ?? null;
  if (visitedOn !== null && (typeof visitedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(visitedOn) || !Number.isFinite(Date.parse(visitedOn)) || new Date(visitedOn).toISOString().slice(0, 10) !== visitedOn || visitedOn < '2000-01-01' || visitedOn > now.toISOString().slice(0, 10))) throw new ReportError(400, 'invalid_visit_date');
  if (['departments', 'shopper-review'].includes(raw.reason) && !visitedOn) throw new ReportError(400, 'visit_date_required');
  const rating = raw.rating ?? null;
  const confirmedVisit = raw.confirmedVisit ?? false;
  if (typeof confirmedVisit !== 'boolean' || (raw.reason === 'shopper-review' ? !Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5 || confirmedVisit !== true : rating !== null || confirmedVisit !== false)) throw new ReportError(400, 'invalid_rating');
  return { storeId: raw.storeId, reason: raw.reason as ReportReason, details, requestId: raw.requestId.toLowerCase(), visitedOn: visitedOn as string | null, rating: rating as number | null, confirmedVisit };
}

/** Bounds the actual stream, including requests with no Content-Length. */
export async function readReportJson(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new ReportError(415, 'json_required');
  const length = request.headers.get('content-length');
  if (length && Number(length) > MAX_BYTES) throw new ReportError(413, 'body_too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new ReportError(400, 'invalid_report');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let body = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        throw new ReportError(413, 'body_too_large');
      }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } catch (error) {
    if (error instanceof ReportError) throw error;
    throw new ReportError(400, 'invalid_report');
  } finally { reader.releaseLock(); }
}

export function requireSameOrigin(request: Request): void {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  const expected = `${url.protocol}//${request.headers.get('host') ?? url.host}`;
  if (!origin || origin !== expected || request.headers.get('sec-fetch-site') === 'cross-site') throw new ReportError(403, 'same_origin_required');
}

/** Only Vercel's overwritten header is trusted; other hosts share a strict bucket. */
export function reporterKey(request: Request, now = new Date(), env = process.env): string {
  const secret = env.REPORTS_RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) throw new ReportError(503, 'reports_unavailable');
  const address = env.VERCEL === '1' ? request.headers.get('x-vercel-forwarded-for')?.trim() : undefined;
  const identity = address && isIP(address) ? address : 'shared-untrusted-host';
  // Hourly salt rotation; the address never enters the report or storage payload.
  return createHmac('sha256', secret).update(`${now.toISOString().slice(0, 13)}:${identity}`).digest('hex');
}

export function requireAdmin(request: Request, env = process.env): string {
  const secret = env.REPORTS_ADMIN_TOKEN;
  if (!secret || secret.length < 32) throw new ReportError(503, 'reports_unavailable');
  const header = request.headers.get('authorization') ?? '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  // Hash both operands to equal lengths before timing-safe comparison.
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (header.length > 1024 || !timingSafeEqual(digest(supplied), digest(secret))) throw new ReportError(401, 'unauthorized');
  return `admin:${digest(secret).toString('hex').slice(0, 12)}`;
}

/** The only required storage operations: private read, atomic create, bounded list. */
export interface ReportStorage {
  read<T>(path: string): Promise<T | null>;
  create(path: string, body: unknown): Promise<boolean>;
  page(prefix: string, cursor?: string): Promise<{ paths: string[]; cursor: string | null }>;
}

export function blobReportStorage(env = process.env): ReportStorage {
  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new ReportError(503, 'reports_unavailable');
  const storage: ReportStorage = {
    async read<T>(path: string): Promise<T | null> {
      try {
        const result = await get(path, { access: 'private', token, useCache: false, abortSignal: AbortSignal.timeout(8000) });
        if (!result) return null;
        if (result.statusCode !== 200 || !result.stream || (result.blob.size ?? 0) > 16384) throw new Error('storage');
        return await new Response(result.stream).json() as T;
      } catch { throw new ReportError(503, 'reports_unavailable'); }
    },
    async create(path, body) {
      try {
        await put(path, JSON.stringify(body), {
          access: 'private', token, addRandomSuffix: false, allowOverwrite: false,
          contentType: 'application/json', abortSignal: AbortSignal.timeout(8000),
        });
        return true;
      } catch {
        // The SDK represents already-exists as a generic BlobError. Confirm the
        // object with a consistent read instead of depending on error wording.
        if (await storage.read(path) !== null) return false;
        throw new ReportError(503, 'reports_unavailable');
      }
    },
    async page(prefix, cursor) {
      try {
        const result = await list({ prefix, cursor, limit: 25, token, abortSignal: AbortSignal.timeout(8000) });
        return { paths: result.blobs.map(blob => blob.pathname), cursor: result.hasMore ? result.cursor ?? null : null };
      } catch { throw new ReportError(503, 'reports_unavailable'); }
    },
  };
  return storage;
}

interface RateClaim { requestId: string; fingerprint: string; expiresAt: string }
interface ReportReview { reportId: string; status: 'approved' | 'rejected'; at: string; actor: string; note: string }
export interface ReportQueue {
  submit(input: ReportInput, reporter: string, now?: Date): Promise<string>;
  list(status: ReportStatus, cursor?: string): Promise<{ reports: ListingReport[]; nextCursor: string | null }>;
  review(id: string, status: 'approved' | 'rejected', note: string, actor: string, now?: Date): Promise<ListingReport>;
}

function sameReport(report: ListingReport, input: ReportInput): boolean {
  return report.storeId === input.storeId && report.reason === input.reason && report.details === input.details && report.visitedOn === input.visitedOn && report.rating === input.rating && report.confirmedVisit === input.confirmedVisit;
}

/** Fixed slot paths and conditional creates enforce a shared 5-per-hour limit. */
async function claimRateSlot(storage: ReportStorage, reporter: string, input: ReportInput, now: Date): Promise<void> {
  const hour = now.toISOString().slice(0, 13).replace('T', '-');
  const fingerprint = createHash('sha256').update(JSON.stringify([input.storeId, input.reason, input.details, input.visitedOn, input.rating, input.confirmedVisit])).digest('hex');
  const claim: RateClaim = { requestId: input.requestId, fingerprint, expiresAt: new Date(now.getTime() + 48 * 3600_000).toISOString() };
  // The same request keeps its slot after a network failure. A failed report
  // write consumes a slot conservatively; it never produces false success.
  for (let slot = 0; slot < 5; slot++) {
    const path = `${PREFIX}rate/${hour}/${reporter}/${slot}.json`;
    if (await storage.create(path, claim)) return;
    const existing = await storage.read<RateClaim>(path);
    if (existing?.requestId === input.requestId && existing.fingerprint === fingerprint) return;
  }
  throw new ReportError(429, 'rate_limited');
}

export function createReportQueue(storage: ReportStorage = blobReportStorage()): ReportQueue {
  return {
    async submit(input, reporter, now = new Date()) {
      const path = `${PREFIX}items/${input.requestId}.json`;
      const existing = await storage.read<ListingReport>(path);
      if (existing) {
        if (!sameReport(existing, input)) throw new ReportError(409, 'request_conflict');
        return existing.id;
      }
      await claimRateSlot(storage, reporter, input, now);
      const report: ListingReport = { version: 1, id: input.requestId, storeId: input.storeId, reason: input.reason, details: input.details, visitedOn: input.visitedOn, rating: input.rating, confirmedVisit: input.confirmedVisit, submittedAt: now.toISOString(), status: 'pending' };
      if (await storage.create(path, report)) return report.id;
      const saved = await storage.read<ListingReport>(path);
      if (!saved) throw new ReportError(503, 'reports_unavailable');
      if (!sameReport(saved, input)) throw new ReportError(409, 'request_conflict');
      return saved.id;
    },
    async list(status, cursor) {
      const page = await storage.page(`${PREFIX}items/`, cursor);
      const reports: ListingReport[] = [];
      // Five concurrent reads, at most 25 entries per page. A partially failed
      // read fails the page so a reviewer never mistakes it for a complete list.
      for (let start = 0; start < page.paths.length; start += 5) {
        const rows = await Promise.all(page.paths.slice(start, start + 5).map(async path => {
          const report = await storage.read<ListingReport>(path);
          if (!report) throw new ReportError(503, 'reports_unavailable');
          const review = await storage.read<ReportReview>(`${PREFIX}reviews/${report.id}.json`);
          return review ? { ...report, status: review.status, review: { at: review.at, actor: review.actor, note: review.note } } : report;
        }));
        reports.push(...rows.filter(row => row.status === status));
      }
      return { reports, nextCursor: page.cursor };
    },
    async review(id, status, note, actor, now = new Date()) {
      const report = await storage.read<ListingReport>(`${PREFIX}items/${id}.json`);
      if (!report) throw new ReportError(404, 'report_not_found');
      const review: ReportReview = { reportId: id, status, at: now.toISOString(), actor, note };
      // This immutable review object is the audit record. A second reviewer
      // cannot overwrite it, including concurrent approve/reject requests.
      if (!await storage.create(`${PREFIX}reviews/${id}.json`, review)) throw new ReportError(409, 'already_reviewed');
      return { ...report, status, review: { at: review.at, actor, note } };
    },
  };
}

export function validateReview(value: unknown): { id: string; status: 'approved' | 'rejected'; note: string } {
  const raw = object(value);
  if (Object.keys(raw).some(key => !['id', 'status', 'note'].includes(key)) || typeof raw.id !== 'string' || !UUID.test(raw.id) || !['approved', 'rejected'].includes(String(raw.status)) || typeof raw.note !== 'string' || raw.note.trim().length < 10 || raw.note.length > 1000 || controlCharacters.test(raw.note)) throw new ReportError(400, 'invalid_review');
  return { id: raw.id.toLowerCase(), status: raw.status as 'approved' | 'rejected', note: raw.note.trim() };
}

export function reportResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...(status === 429 ? { 'Retry-After': '3600' } : {}) } });
}
export function reportErrorResponse(error: unknown): Response {
  // Deliberately do not log private report text, credentials, or network errors.
  const issue = error instanceof ReportError ? error : new ReportError(503, 'reports_unavailable');
  return reportResponse({ error: issue.code }, issue.status);
}
