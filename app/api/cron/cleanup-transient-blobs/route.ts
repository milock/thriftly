import { createHash, timingSafeEqual } from "node:crypto";
import { cleanupTransientBlobs } from "@/lib/transient-blob-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const headers = { "Cache-Control": "private, no-store" };

export function HEAD(): Response {
  return new Response(null, { status: 405, headers: { ...headers, Allow: "GET" } });
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!secret || secret.length < 16 || authorization.length > 1024 ||
      !timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`))) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return Response.json({ error: "cleanup_unavailable" }, { status: 503, headers });

  try {
    const result = await cleanupTransientBlobs(token);
    if (result.incomplete) console.warn("Transient Blob cleanup reached its work limit", result);
    return Response.json(result, { headers });
  } catch {
    console.error("Transient Blob cleanup failed");
    return Response.json({ error: "cleanup_unavailable" }, { status: 503, headers });
  }
}
