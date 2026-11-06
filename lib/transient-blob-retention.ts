import { del, list, type ListBlobResult } from "@vercel/blob";

const DAY_MS = 24 * 60 * 60_000;
const RETENTION_MS = 7 * DAY_MS;
const WINDOW_MS = 5 * 60_000;
const MAX_FOLDER_PAGES = 8;
const MAX_OBJECT_PAGES = 8;
const OBJECT_PAGE_SIZE = 500;
const DELETE_BATCH_SIZE = 100;
const RUN_TIMEOUT_MS = 23_000;
const OPERATION_TIMEOUT_MS = 4000;

type BucketType = "window" | "day" | "hour";
type LeafType = "hash" | "place-rate" | "report-rate";

const namespaces = [
  { prefix: "place-matches/v1/rate/", bucket: "window", leaf: "place-rate" },
  { prefix: "place-matches/v1/claims/", bucket: "window", leaf: "hash" },
  { prefix: "place-matches/v1/empty/", bucket: "window", leaf: "hash" },
  { prefix: "place-matches/v1/ids/", bucket: "day", leaf: "hash" },
  { prefix: "reports/v1/rate/", bucket: "hour", leaf: "report-rate" },
] as const satisfies ReadonlyArray<{ prefix: string; bucket: BucketType; leaf: LeafType }>;

type Namespace = (typeof namespaces)[number];
type CleanupResult = { scanned: number; deleted: number; incomplete: boolean };

function bucketTimestamp(bucket: string, type: BucketType): number {
  if (type === "window") {
    if (!/^(?:0|[1-9][0-9]{0,10})$/.test(bucket)) return NaN;
    const index = Number(bucket);
    return String(index) === bucket ? index * WINDOW_MS : NaN;
  }
  const format = type === "day" ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}-\d{2}$/;
  if (!format.test(bucket)) return NaN;
  const iso = type === "day" ? `${bucket}T00:00:00.000Z` : `${bucket.slice(0, 10)}T${bucket.slice(11)}:00:00.000Z`;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return NaN;
  const normalized = new Date(time).toISOString().slice(0, type === "day" ? 10 : 13).replace("T", "-");
  return normalized === bucket ? time : NaN;
}

function validHash(value: string): boolean {
  return value.length === 64 && /^[a-f0-9]{64}$/.test(value);
}

function allowedPath(pathname: string, namespace: Namespace, cutoff: number): boolean {
  if (!pathname.startsWith(namespace.prefix) || !pathname.endsWith(".json")) return false;
  const [bucket, ...parts] = pathname.slice(namespace.prefix.length).split("/");
  if (!(bucketTimestamp(bucket, namespace.bucket) <= cutoff)) return false;

  if (namespace.leaf === "hash") {
    return parts.length === 1 && validHash(parts[0].slice(0, -5));
  }
  if (parts.length !== 2 || !validHash(parts[0])) return false;
  const slot = namespace.leaf === "place-rate" ? /^(?:[0-9]|[1-5][0-9])\.json$/ : /^[0-4]\.json$/;
  return slot.test(parts[1]);
}

function listGroup(bucket: string, type: BucketType): string {
  if (type === "hour") return `${bucket.slice(0, 10)}-`;
  // Combine nearby numeric five-minute buckets into one listing. Every object
  // still goes through both age checks before it can enter a deletion batch.
  if (type === "window" && bucket.length > 2) return bucket.slice(0, -2);
  return `${bucket}/`;
}

async function cleanNamespace(namespace: Namespace, cutoff: number, token: string, runSignal: AbortSignal): Promise<CleanupResult> {
  const operation = () => {
    runSignal.throwIfAborted();
    return AbortSignal.any([runSignal, AbortSignal.timeout(OPERATION_TIMEOUT_MS)]);
  };
  const groups = new Map<string, number>();
  let cursor: string | undefined;
  let incomplete = false;

  // List folders before objects so a large recent workload cannot crowd old
  // buckets out of the object pages. Visit the oldest groups first.
  for (let pageIndex = 0; pageIndex < MAX_FOLDER_PAGES; pageIndex++) {
    const page = await list({ prefix: namespace.prefix, mode: "folded", limit: 1000, cursor, token, abortSignal: operation() });
    for (const folder of page.folders) {
      if (!folder.startsWith(namespace.prefix) || !folder.endsWith("/")) continue;
      const bucket = folder.slice(namespace.prefix.length, -1);
      const stamp = bucketTimestamp(bucket, namespace.bucket);
      if (!(stamp <= cutoff)) continue;
      const group = listGroup(bucket, namespace.bucket);
      groups.set(group, Math.min(stamp, groups.get(group) ?? stamp));
    }
    if (!page.hasMore) break;
    if (!page.cursor || page.cursor === cursor || pageIndex + 1 === MAX_FOLDER_PAGES) {
      incomplete = true;
      break;
    }
    cursor = page.cursor;
  }

  const expired = new Set<string>();
  let scanned = 0;
  let pages = 0;
  groupsLoop: for (const [group] of [...groups].sort((a, b) => a[1] - b[1])) {
    const prefix = namespace.prefix + group;
    cursor = undefined;
    while (true) {
      if (pages >= MAX_OBJECT_PAGES) {
        incomplete = true;
        break groupsLoop;
      }
      const page: ListBlobResult = await list({ prefix, limit: OBJECT_PAGE_SIZE, cursor, token, abortSignal: operation() });
      pages++;
      for (const blob of page.blobs.slice(0, OBJECT_PAGE_SIZE)) {
        scanned++;
        if (
          blob.pathname.startsWith(prefix) &&
          allowedPath(blob.pathname, namespace, cutoff) &&
          blob.uploadedAt instanceof Date &&
          blob.uploadedAt.getTime() <= cutoff
        ) expired.add(blob.pathname);
      }
      if (!page.hasMore) break;
      if (!page.cursor || page.cursor === cursor) {
        incomplete = true;
        break;
      }
      cursor = page.cursor;
    }
  }

  // Finish pagination before deleting any of the listed objects.
  const paths = [...expired];
  for (let start = 0; start < paths.length; start += DELETE_BATCH_SIZE) {
    await del(paths.slice(start, start + DELETE_BATCH_SIZE), { token, abortSignal: operation() });
  }
  return { scanned, deleted: paths.length, incomplete };
}

export async function cleanupTransientBlobs(token: string, now = new Date()): Promise<CleanupResult> {
  const cutoff = now.getTime() - RETENTION_MS;
  if (!Number.isFinite(cutoff)) throw new Error("Invalid retention date");
  const runSignal = AbortSignal.timeout(RUN_TIMEOUT_MS);
  const results = await Promise.allSettled(namespaces.map(namespace => cleanNamespace(namespace, cutoff, token, runSignal)));
  const total = { scanned: 0, deleted: 0, incomplete: false };
  for (const result of results) {
    if (result.status === "rejected") throw new Error("Transient Blob cleanup failed");
    total.scanned += result.value.scanned;
    total.deleted += result.value.deleted;
    total.incomplete ||= result.value.incomplete;
  }
  return total;
}
