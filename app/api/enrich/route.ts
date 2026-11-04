import { NextResponse } from 'next/server';
import { reverseAddress } from '@/lib/geocode';
import { isKnownStorePoint } from '@/lib/locate';

export const maxDuration = 60;

const MAX_BYTES = 16_384;
interface Point { lat: number; lon: number }

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  // Next can use an internal hostname in request.url behind a reverse proxy.
  // Host is the browser's target authority; preserve the trusted URL scheme.
  const url = new URL(request.url);
  const expectedOrigin = `${url.protocol}//${request.headers.get('host') ?? url.host}`;
  if ((origin && origin !== expectedOrigin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({error:'same-origin requests required'}, {status:403});
  }
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return NextResponse.json({error:'JSON required'}, {status:415});
  }
  // Bound streamed bytes too; Content-Length is optional and cannot be trusted.
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({error:'body required'}, {status:400});
  let size = 0;
  let text = '';
  const decoder = new TextDecoder();
  let body: unknown;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return NextResponse.json({error:'body too large'}, {status:413});
      }
      text += decoder.decode(value, {stream:true});
    }
    body = JSON.parse(text + decoder.decode());
  } catch { return NextResponse.json({error:'invalid JSON'}, {status:400}); }
  finally { reader.releaseLock(); }
  const raw = (body as {points?: unknown})?.points;
  if (!Array.isArray(raw) || raw.length > 60 || !raw.every(p =>
    p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && isKnownStorePoint(p.lat, p.lon))) {
    return NextResponse.json({error:'up to 60 published store coordinates required'}, {status:400});
  }
  const points: Point[] = [...new Map(raw.map(p => [`${p.lat},${p.lon}`, p])).values()].slice(0, 20);
  const enriched: Record<string, Awaited<ReturnType<typeof reverseAddress>>> = {};
  let next = 0;
  const worker = async () => {
    while (next < points.length) {
      const p = points[next++];
      const rev = await reverseAddress(p.lat, p.lon);
      if (rev) enriched[`${p.lat},${p.lon}`] = rev;
    }
  };
  await Promise.all(Array.from({length: Math.min(2, points.length)}, worker));
  return NextResponse.json({enriched});
}
