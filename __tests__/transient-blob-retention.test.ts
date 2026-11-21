import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const blob = vi.hoisted(() => ({ list: vi.fn(), del: vi.fn() }));
vi.mock("@vercel/blob", () => blob);

import { GET, HEAD } from "@/app/api/cron/cleanup-transient-blobs/route";
import { cleanupTransientBlobs } from "@/lib/transient-blob-retention";

const now = new Date("2026-11-12T20:25:00Z");
const cutoff = new Date("2026-11-05T20:25:00Z");
const recent = new Date(cutoff.getTime() + 1);
const windowOf = (time: Date) => Math.floor(time.getTime() / (5 * 60_000));
const oldWindow = windowOf(cutoff);
const hash = "a".repeat(64);
const place = "place-matches/v1";
const reports = "reports/v1";
const file = (pathname: string, uploadedAt = cutoff) => ({ pathname, uploadedAt });

function setRows(rows: Array<ReturnType<typeof file>>) {
  blob.list.mockImplementation(async ({ prefix, mode }: { prefix: string; mode?: string }) => {
    if (mode === "folded") {
      const folders = rows
        .filter(row => row.pathname.startsWith(prefix))
        .map(row => `${prefix}${row.pathname.slice(prefix.length).split("/")[0]}/`);
      return { folders: [...new Set(folders)], blobs: [], hasMore: false };
    }
    // The last item simulates an incorrect listing response from storage.
    return { blobs: [...rows.filter(row => row.pathname.startsWith(prefix)), file(`${reports}/items/real-report.json`)], hasMore: false };
  });
}

beforeEach(() => {
  blob.list.mockReset();
  blob.del.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("transient Blob retention", () => {
  it("only deletes expired objects from the five exact namespaces", async () => {
    const expired = [
      file(`${place}/rate/${oldWindow}/${hash}/59.json`),
      file(`${place}/claims/${oldWindow}/${hash}.json`),
      file(`${place}/empty/${oldWindow}/${hash}.json`),
      file(`${place}/ids/2026-11-05/${hash}.json`),
      file(`${reports}/rate/2026-11-05-20/${hash}/4.json`),
    ];
    setRows([
      ...expired,
      file(`${place}/ids/2026-11-06/${hash}.json`),
      file(`${place}/ids/2026-11-04/${hash}.json`, recent),
      file(`${place}/ids/2026-02-30/${hash}.json`),
      file(`${place}/ids/2026-9-05/${hash}.json`),
      file(`${place}/ids/2026-11-05/${hash}.json\n`),
      file(`${place}/claims/0${oldWindow}/${hash}.json`),
      file(`${place}/claims/${oldWindow + 1}/${hash}.json`),
      file(`${place}/claims/${oldWindow}/extra/${hash}.json`),
      file(`${place}/rate/${oldWindow}/${hash}/60.json`),
      file(`${place}/rate/${oldWindow}/${hash}/01.json`),
      file(`${place}/empty/${oldWindow}/short.json`),
      file(`${reports}/rate/2026-11-05-24/${hash}/0.json`),
      file(`${reports}/rate/2026-11-05-21/${hash}/0.json`),
      file(`${reports}/rate/2026-11-04-20/${hash}/5.json`),
      file(`${reports}/rate/2026-11-04-20/${hash}/0.json`, new Date(NaN)),
      file(`${reports}/items/2026-11-05/${hash}.json`),
      file(`${reports}/reviews/2026-11-05/${hash}.json`),
      file(`${reports}/qa/2026-11-05/${hash}.json`),
      file(`place-matches/v2/ids/2026-11-05/${hash}.json`),
    ]);
    const result = await cleanupTransientBlobs("fake-private-token", now);
    expect(result.deleted).toBe(5);
    const deleted = blob.del.mock.calls.flatMap(([paths]) => paths);
    expect(deleted.sort()).toEqual(expired.map(row => row.pathname).sort());
    expect(blob.del.mock.calls.every(([, opts]) => opts.token === "fake-private-token" && opts.abortSignal instanceof AbortSignal)).toBe(true);
  });

  it("bounds list calls and delete batch size even with an ongoing backlog", async () => {
    const prefix = `${place}/ids/`;
    blob.list.mockImplementation(async ({ mode, cursor }: { mode?: string; cursor?: string }) => {
      if (mode === "folded") return { folders: [`${prefix}2026-11-01/`], blobs: [], hasMore: false };
      const offset = Number(cursor ?? 0);
      return {
        blobs: Array.from({ length: 500 }, (_, index) => file(`${prefix}2026-11-01/${(offset + index).toString(16).padStart(64, "0")}.json`)),
        hasMore: true,
        cursor: String(offset + 500),
      };
    });
    const result = await cleanupTransientBlobs("fake-private-token", now);
    expect(result.incomplete).toBe(true);
    expect(blob.list.mock.calls.length).toBeLessThanOrEqual(50);
    expect(blob.del.mock.calls.every(([paths]) => paths.length <= 100)).toBe(true);
    expect(result.deleted).toBe(4000);
  });
});

describe("cron endpoint", () => {
  const cronSecret = "test-cron-secret-with-high-entropy";
  const endpoint = "https://thriftly.xyz/api/cron/cleanup-transient-blobs";
  function request(auth?: string) {
    return new Request(endpoint, { headers: auth ? { Authorization: auth } : {} });
  }

  it("fails closed with an unset secret or incorrect bearer and disables implicit HEAD execution", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request())).status).toBe(401);
    vi.stubEnv("CRON_SECRET", cronSecret);
    expect((await GET(request("Bearer wrong-secret"))).status).toBe(401);
    expect(HEAD().status).toBe(405);
    expect(blob.list).not.toHaveBeenCalled();
    expect(blob.del).not.toHaveBeenCalled();
  });

  it("requires a Blob credential and returns only aggregate counts", async () => {
    vi.stubEnv("CRON_SECRET", cronSecret);
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    expect((await GET(request(`Bearer ${cronSecret}`))).status).toBe(503);
    expect(blob.list).not.toHaveBeenCalled();

    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "fake-private-token");
    setRows([]);
    const response = await GET(request(`Bearer ${cronSecret}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ scanned: 0, deleted: 0, incomplete: false });
  });

  it("does not expose a storage error or delete records when listing fails", async () => {
    vi.stubEnv("CRON_SECRET", cronSecret);
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "fake-private-token");
    blob.list.mockRejectedValue(new Error("private pathname or credential"));
    const response = await GET(request(`Bearer ${cronSecret}`));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "cleanup_unavailable" });
    expect(blob.del).not.toHaveBeenCalled();
  });
});
