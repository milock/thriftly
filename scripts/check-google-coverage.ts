/** Snapshot public coverage before a weekly refresh; reject large drops before commit. */
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {allBundledStores} from '../lib/locate';

export function coverageRegression(previous: number, current: number, maximumDrop = 0.15) {
  if (![previous, current].every(value => Number.isSafeInteger(value) && value >= 0) || !Number.isFinite(maximumDrop) || maximumDrop < 0 || maximumDrop > 1) throw new Error('Invalid coverage counts');
  const dropFraction = previous === 0 ? 0 : Math.max(0, previous - current) / previous;
  return {previous, current, maximumDrop, dropFraction, allowed: dropFraction <= maximumDrop};
}

function main() {
  const args = process.argv.slice(2);
  const current = allBundledStores().length;
  const writeIndex = args.indexOf('--write-baseline');
  if (writeIndex >= 0) {
    const path = args[writeIndex + 1];
    if (!path) throw new Error('Missing baseline path');
    writeFileSync(resolve(path), JSON.stringify({version: 1, confirmed: current}) + '\n');
    console.log(JSON.stringify({baseline: current}));
    return;
  }
  const index = args.indexOf('--baseline');
  if (index < 0 || !args[index + 1]) throw new Error('Use --write-baseline PATH before refresh, then --baseline PATH after refresh');
  const baseline = JSON.parse(readFileSync(resolve(args[index + 1]), 'utf8'));
  if (baseline.version !== 1) throw new Error('Invalid baseline');
  const result = coverageRegression(baseline.confirmed, current);
  console.log(JSON.stringify(result));
  if (!result.allowed) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {main();} catch {console.error('Coverage guard failed: baseline is missing or invalid.'); process.exitCode = 1;}
}
