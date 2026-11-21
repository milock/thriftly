import {existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';

/** All the Places publishes weekly, and a run finishes several days after its
 * spiders collect. A Monday refresh therefore sees data that is 8 to 10 days old
 * even when nothing is wrong, so ATP extracts get three weekly releases of slack. */
export const ATP_MAX_AGE_DAYS = 21;
/** How long one source may keep serving its last accepted data while the rest of
 * the registry refreshes. Past this the refresh still publishes, then fails loudly. */
export const LAST_GOOD_HOLD_DAYS = 60;
export const SOURCE_HEALTH_PATH = '.cache/source-health.json';

export type SourceStatus = 'refreshed' | 'unchanged' | 'retained-last-good' | 'overdue' | 'failed';
export interface SourceHealth {source: string; status: SourceStatus; sourceUpdatedAt?: string; reason?: string; checkedAt: string}

export function ageDays(stamp: string | undefined, now = Date.now()): number {
  const time = Date.parse(stamp ?? '');
  return Number.isFinite(time) ? (now - time) / 86400000 : Number.POSITIVE_INFINITY;
}

/** Retained data stays usable for the hold window; afterwards it is flagged overdue. */
export function retentionStatus(stamp: string | undefined, now = Date.now()): 'retained-last-good' | 'overdue' {
  return ageDays(stamp, now) > LAST_GOOD_HOLD_DAYS ? 'overdue' : 'retained-last-good';
}

/** Short, single-line reason safe for logs and provenance (no URLs or bodies). */
export function failureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : 'unknown failure';
  return message.replace(/https?:\/\/\S+/g, '[url]').replace(/\s+/g, ' ').slice(0, 160);
}

export function readSourceHealth(path = SOURCE_HEALTH_PATH): SourceHealth[] {
  if (!existsSync(path)) return [];
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(value) ? value.filter(row => row && typeof row.source === 'string' && typeof row.status === 'string') : [];
  } catch { return []; }
}

/** One row per source; the latest report for a source replaces earlier ones. */
export function recordSourceHealth(entry: Omit<SourceHealth, 'checkedAt'>, path = SOURCE_HEALTH_PATH, now = new Date()) {
  const rows = readSourceHealth(path).filter(row => row.source !== entry.source);
  rows.push({...entry, checkedAt: now.toISOString()});
  rows.sort((a, b) => a.source.localeCompare(b.source));
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path + '.tmp', JSON.stringify(rows, null, 2) + '\n');
  renameSync(path + '.tmp', path);
  const line = `${entry.source}: ${entry.status}${entry.reason ? ` (${entry.reason})` : ''}`;
  if (entry.status === 'refreshed' || entry.status === 'unchanged') console.log(line);
  else console.warn(`::warning::${line}`);
}

export function unhealthySources(rows: readonly SourceHealth[]) {
  return rows.filter(row => row.status === 'overdue' || row.status === 'failed');
}
