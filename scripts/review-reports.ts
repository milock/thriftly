/**
 * Private review CLI. Supply credentials through the environment, never argv.
 * npx tsx scripts/review-reports.ts list [pending|approved|rejected] [cursor]
 * npx tsx scripts/review-reports.ts approve REPORT_ID 'Verification note'
 * npx tsx scripts/review-reports.ts reject REPORT_ID 'Rejection note'
 */
async function main() {
  const base = process.env.THRIFTLY_ADMIN_BASE_URL;
  const token = process.env.REPORTS_ADMIN_TOKEN;
  if (!base || !token) throw new Error('Set THRIFTLY_ADMIN_BASE_URL and REPORTS_ADMIN_TOKEN in the environment.');
  const url = new URL('/api/admin/reports', base);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) || url.username || url.password) throw new Error('The admin URL must use HTTPS (except local development).');
  const [command, value, noteOrCursor, ...extra] = process.argv.slice(2);
  if (extra.length) throw new Error('Too many arguments. Quote the review note.');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  let response: Response;
  if (command === 'list') {
    url.searchParams.set('status', value ?? 'pending');
    if (noteOrCursor) url.searchParams.set('cursor', noteOrCursor);
    response = await fetch(url, { headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(60000) });
  } else if ((command === 'approve' || command === 'reject') && value && noteOrCursor) {
    response = await fetch(url, { method: 'PATCH', headers, redirect: 'error', signal: AbortSignal.timeout(60000), body: JSON.stringify({ id: value, status: command === 'approve' ? 'approved' : 'rejected', note: noteOrCursor }) });
  } else {
    throw new Error('Use: list [status] [cursor], approve REPORT_ID "Verification note", or reject REPORT_ID "Rejection note".');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(`Review request failed (${response.status}): ${body?.error ?? 'service unavailable'}`);
  }
  // JSON serialization escapes control characters in untrusted report text.
  console.log(JSON.stringify(await response.json(), null, 2));
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Review request failed.');
  process.exitCode = 1;
});
