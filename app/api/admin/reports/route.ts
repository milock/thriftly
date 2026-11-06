import { createReportQueue, readReportJson, ReportError, reportErrorResponse, reportResponse, requireAdmin, validateReview, type ReportStatus } from '@/lib/listing-reports';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    const params = new URL(request.url).searchParams;
    const status = params.get('status') ?? 'pending';
    const cursor = params.get('cursor') ?? undefined;
    if (!['pending', 'approved', 'rejected'].includes(status) || (cursor && (cursor.length > 2048 || /[\u0000-\u001f]/.test(cursor)))) throw new ReportError(400, 'invalid_query');
    return reportResponse(await createReportQueue().list(status as ReportStatus, cursor));
  } catch (error) { return reportErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const actor = requireAdmin(request);
    const input = validateReview(await readReportJson(request));
    const report = await createReportQueue().review(input.id, input.status, input.note, actor);
    return reportResponse({ report, publicDataChanged: false });
  } catch (error) { return reportErrorResponse(error); }
}
