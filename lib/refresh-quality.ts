/** Fail closed: an upstream outage must not overwrite the last good dataset. */
export function assertRefreshQuality(input: {
  previousCount: number; count: number; emptyStates: string[];
  failedCounties: string[]; scoredCount: number; previousScoredCount: number;
}) {
  if (input.emptyStates.length) throw new Error(`Missing states: ${input.emptyStates.join(', ')}`);
  if (input.failedCounties.length) throw new Error(`Census failed for ${input.failedCounties.length} counties`);
  if (input.count < Math.max(100, input.previousCount * 0.9)) throw new Error('Store coverage dropped more than 10%');
  if (input.scoredCount < Math.max(100, input.previousScoredCount * 0.9)) throw new Error('Scoring coverage dropped more than 10%');
}
