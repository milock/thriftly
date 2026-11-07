import 'server-only';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import type { LiveGoogleDetails, LiveGoogleHours } from '@/lib/types';

export const DETAILS_FIELD_MASK = 'id,displayName,formattedAddress,location,businessStatus,currentOpeningHours,regularOpeningHours,nationalPhoneNumber,websiteUri,rating,userRatingCount,googleMapsUri,attributions';
const PLACE_ID = /^[\w-]{6,512}$/;
const DEADLINE_MS = 5000;
const MAX_PENDING = 64;
const WINDOW_MS = 5 * 60_000;
const MAX_IDENTITIES = 10_000;
const MAX_REQUESTS = 240;

export class DetailsError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}
function text(value: unknown, max = 1000): string | null {
  return typeof value === 'string' && value.trim() && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) ? value.trim() : null;
}
function number(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function safeUrl(value: unknown, maps = false): string | null {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if (maps && !['google.com', 'www.google.com', 'maps.google.com', 'maps.app.goo.gl'].includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}
function hours(value: unknown): LiveGoogleHours | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = object(value);
  return {
    openNow: typeof raw.openNow === 'boolean' ? raw.openNow : null,
    weekdayDescriptions: Array.isArray(raw.weekdayDescriptions) ? raw.weekdayDescriptions.slice(0, 7).map(value => text(value, 500)).filter((value): value is string => value !== null) : [],
  };
}

/** Accept only an exact requested identity and return our explicit minimal DTO. */
export function normalizeGoogleDetails(value: unknown, placeId: string): LiveGoogleDetails {
  const raw = object(value);
  const location = object(raw.location);
  const name = text(object(raw.displayName).text);
  const address = text(raw.formattedAddress);
  if (raw.id !== placeId || !PLACE_ID.test(placeId) || !name || !address || !number(location.latitude, -90, 90) || !number(location.longitude, -180, 180)) throw new DetailsError(503, 'details_unavailable');
  const rating = number(raw.rating, 1, 5) ? raw.rating : null;
  const ratingCount = typeof raw.userRatingCount === 'number' && Number.isSafeInteger(raw.userRatingCount) && raw.userRatingCount >= 0 ? raw.userRatingCount : null;
  return {
    placeId, name, address,
    location: { lat: location.latitude, lon: location.longitude },
    businessStatus: ['OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY'].includes(String(raw.businessStatus)) ? raw.businessStatus as LiveGoogleDetails['businessStatus'] : null,
    currentOpeningHours: hours(raw.currentOpeningHours),
    regularOpeningHours: hours(raw.regularOpeningHours),
    phone: text(raw.nationalPhoneNumber, 100),
    website: safeUrl(raw.websiteUri), rating, ratingCount,
    mapsUrl: safeUrl(raw.googleMapsUri, true),
    attributions: Array.isArray(raw.attributions) ? raw.attributions.slice(0, 20).flatMap(value => {
      const item = object(value);
      const provider = text(item.provider, 300);
      return provider ? [{ provider, providerUri: safeUrl(item.providerUri) }] : [];
    }) : [],
  };
}

/** Warm-instance abuse guard. No raw IPs, persistent identities, or Google payload cache. */
export function createDetailsRateLimiter() {
  const identities = new Map<string, { count: number; expires: number }>();
  return (identity: string, now = Date.now()): void => {
    for (const [key, bucket] of identities) if (bucket.expires <= now) identities.delete(key);
    const bucket = identities.get(identity);
    if (bucket) {
      if (bucket.count >= MAX_REQUESTS) throw new DetailsError(429, 'rate_limited');
      bucket.count++;
      return;
    }
    if (identities.size >= MAX_IDENTITIES) throw new DetailsError(429, 'rate_limited');
    identities.set(identity, { count: 1, expires: now + WINDOW_MS });
  };
}

export function detailsIdentity(request: Pick<Request, 'headers'>, now = Date.now(), env = process.env): string {
  const secret = env.REPORTS_RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) throw new DetailsError(503, 'details_unavailable');
  const supplied = env.VERCEL === '1' ? request.headers.get('x-vercel-forwarded-for')?.trim() : null;
  const identity = supplied && isIP(supplied) ? supplied : 'shared-untrusted-host';
  return createHmac('sha256', secret).update(`details:${Math.floor(now / WINDOW_MS)}:${identity}`).digest('hex');
}

/** Dedupe only pending fetches. Settled results are removed, including failures. */
export function createGoogleDetailsLoader(fetcher: typeof fetch = fetch) {
  const pending = new Map<string, Promise<LiveGoogleDetails>>();
  return (placeId: string, apiKey: string): Promise<LiveGoogleDetails> => {
    if (!PLACE_ID.test(placeId) || !apiKey) return Promise.reject(new DetailsError(503, 'details_unavailable'));
    const existing = pending.get(placeId);
    if (existing) return existing;
    if (pending.size >= MAX_PENDING) return Promise.reject(new DetailsError(429, 'details_busy'));
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new DetailsError(504, 'details_timeout')); }, DEADLINE_MS);
    });
    const lookup = (async () => {
      try {
        const response = await fetcher(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
          method: 'GET', cache: 'no-store', redirect: 'error', signal: controller.signal,
          headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': DETAILS_FIELD_MASK },
        });
        if (!response.ok) throw new DetailsError(503, 'details_unavailable');
        return normalizeGoogleDetails(await response.json(), placeId);
      } catch (error) {
        if (error instanceof DetailsError) throw error;
        throw new DetailsError(controller.signal.aborted ? 504 : 503, controller.signal.aborted ? 'details_timeout' : 'details_unavailable');
      }
    })();
    const work = Promise.race([lookup, deadline]).finally(() => { clearTimeout(timer); pending.delete(placeId); });
    pending.set(placeId, work);
    return work;
  };
}

export function detailsResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    ...(status === 429 ? { 'Retry-After': '300' } : {}),
  } });
}
