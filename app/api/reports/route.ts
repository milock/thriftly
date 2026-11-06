import { allBundledStores } from '@/lib/locate';
import { createReportQueue, readReportJson, reportErrorResponse, reporterKey, reportResponse, requireSameOrigin, validateReport } from '@/lib/listing-reports';

export const runtime = 'nodejs';
export const maxDuration = 60;

// There is intentionally no public GET handler.
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const now = new Date();
    const input = validateReport(await readReportJson(request), new Set(allBundledStores().map(store => store.id)), now);
    const id = await createReportQueue().submit(input, reporterKey(request, now), now);
    return reportResponse({ id, status: 'pending' }, 201);
  } catch (error) { return reportErrorResponse(error); }
}
