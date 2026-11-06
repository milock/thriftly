import { readReportJson, requireSameOrigin, ReportError } from '@/lib/listing-reports';
import { DetailsError, detailsResponse } from '@/lib/google-place-details';
import { loadStoreGoogleDetails } from '@/lib/store-details-service';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (new URL(request.url).search) throw new DetailsError(400, 'invalid_request');
    const body = await readReportJson(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new DetailsError(400, 'invalid_request');
    const input = body as Record<string, unknown>;
    if (Object.keys(input).length !== 1 || typeof input.storeId !== 'string' || input.storeId.length > 200) throw new DetailsError(400, 'invalid_request');
    const google = await loadStoreGoogleDetails(input.storeId, request);
    return detailsResponse({ storeId: input.storeId, google });
  } catch (error) {
    // No upstream body, credentials, request identifiers, or network error logs.
    if (error instanceof DetailsError) return detailsResponse({ error: error.code }, error.status);
    if (error instanceof ReportError) return detailsResponse({ error: error.code === 'invalid_report' ? 'invalid_request' : error.code }, error.status);
    return detailsResponse({ error: 'details_unavailable' }, 503);
  }
}
