/** Summarise each source after the refresh. The data commit has already happened,
 * so a failure here is a notification (GitHub emails failed scheduled runs), not a
 * reason the other sources stayed stale. */
import {appendFileSync} from 'node:fs';
import {ageDays,readSourceHealth,unhealthySources} from '../lib/source-health';

const rows=readSourceHealth();
const goodwillBuild=process.env.GOODWILL_BUILD_OUTCOME;
const lines=['| Source | Status | Data as of | Note |','| --- | --- | --- | --- |',
 ...rows.map(r=>`| ${r.source} | ${r.status} | ${r.sourceUpdatedAt?`${r.sourceUpdatedAt.slice(0,10)} (${Math.floor(ageDays(r.sourceUpdatedAt))} days)`:'n/a'} | ${(r.reason??'').replace(/\|/g,'/')} |`)];
if(goodwillBuild==='failure')lines.push('','Goodwill rebuild failed; the previous Goodwill dataset stayed in place.');
const summary=['## Store source health','',...lines].join('\n');
console.log(summary);
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+'\n');
const bad=unhealthySources(rows);
if(!rows.length){console.error('::error::No source health was recorded');process.exitCode=1;}
else if(bad.length||goodwillBuild==='failure'){for(const r of bad)console.error(`::error::${r.source} is ${r.status}: ${r.reason??'see summary'}`);process.exitCode=1;}
