/** Fail closed: an upstream outage must not overwrite the last good dataset. */
export function assertRefreshQuality(input: {
  previousCount: number; count: number; emptyStates: string[];
  failedCounties: string[]; scoredCount: number; previousScoredCount: number;
  unclassifiedCount?: number; missingTimezoneCount?: number;
}) {
  if (input.unclassifiedCount) throw new Error('Non-shopping or unclassified locations cannot be published');
  if (input.missingTimezoneCount) throw new Error('Every store requires an IANA time zone');
  if (input.emptyStates.length) throw new Error(`Missing states: ${input.emptyStates.join(', ')}`);
  if (input.failedCounties.length) throw new Error(`Census failed for ${input.failedCounties.length} counties`);
  if (input.count < Math.max(100, input.previousCount * 0.9)) throw new Error('Store coverage dropped more than 10%');
  if (input.scoredCount < Math.max(100, input.previousScoredCount * 0.9)) throw new Error('Scoring coverage dropped more than 10%');
}

/** Normal refreshes require a source collected within seven days. A bounded,
 * explicit one-off historical import is available for a verified last-good release. */
export function assertSourceSnapshot(stamp: string | undefined, options: {allowHistorical?: boolean} = {}) {
  const time=Date.parse(stamp ?? ''); const age=Date.now()-time;
  if(!Number.isFinite(time)||age < -300000 || age > (options.allowHistorical ? 45 : 7)*86400000) {
    throw new Error('Store source is stale, missing a collection date, or dated in the future');
  }
}

/** A previously accepted identical snapshot may remain in service for 45 days.
 * This is a poll/no-op, never a newly refreshed dataset or acceptance of stale data. */
export function isAcceptedSourceUnchanged(candidate: {sourceUpdatedAt:string;sha256:string;runId:string}, accepted?: {sourceUpdatedAt?:string;runId?:string;partitions?:{sha256:string}[]}) {
  const same=!!accepted && accepted.sourceUpdatedAt===candidate.sourceUpdatedAt && accepted.runId===candidate.runId && !!accepted.partitions?.length && accepted.partitions.every(p=>p.sha256===candidate.sha256);
  if(same)assertSourceSnapshot(candidate.sourceUpdatedAt,{allowHistorical:true});
  return same;
}
