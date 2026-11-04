import Link from 'next/link';
import {pageMetadata} from '@/lib/seo';
import {CityHeader, CityFooter} from '@/components/city/chrome';
import {WEIGHTS, CATCHMENT_RADIUS_MILES} from '@/lib/reference-ranges';
import {datasetGeneratedAt} from '@/lib/locate';

export const metadata=pageMetadata('How Thriftly scores Goodwill stores','Understand the Goods Score: Census measures, weights, data dates and limitations. A neighborhood score is not a store review or an inventory forecast.','/how-we-score');
export default function MethodologyPage() {
  const factors=[
    ['Median home value',WEIGHTS.medianHomeValue],
    ['Median household income',WEIGHTS.medianHouseholdIncome],
    ["Share of adults with a bachelor’s degree or higher",WEIGHTS.pctBachelorsPlus],
    ['Median gross rent',WEIGHTS.medianGrossRent],
  ] as const;
  return <div className="flex min-h-dvh flex-col"><CityHeader/><main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-5 py-12">
    <nav aria-label="Breadcrumb"><Link href="/">Home</Link> / How we score</nav>
    <h1 className="text-4xl font-semibold tracking-tight">How Thriftly scores Goodwill stores</h1>
    <p className="text-lg">The Goods Score is a 0 to 100 comparison of the neighborhoods around a store. It helps you choose places to explore. It does not measure merchandise, donation quality, prices or customer satisfaction.</p>
    <section className="space-y-4"><h2 className="text-2xl font-semibold">Four Census measures</h2>
      <table className="w-full text-left"><caption className="sr-only">Goods Score factor weights</caption><thead><tr><th className="py-3">Measure</th><th>Weight</th></tr></thead><tbody>{factors.map(([name,weight])=><tr key={name} className="border-t border-border"><td className="py-3">{name}</td><td>{Math.round(weight*100)}%</td></tr>)}</tbody></table>
      <p>We use Census tracts whose center points lie within {CATCHMENT_RADIUS_MILES} miles of the store. Each measure is averaged using population and distance: more populous, closer tracts contribute more. This is a geographic approximation, not a study of who donates to that store.</p>
      <p>Each measure is normalized against fixed ranges in our open-source model. Home value uses a logarithmic scale. Missing measures contribute zero, so a low score can reflect missing data. A score of 80 is not an 80th-percentile ranking or an 80% chance of finding something.</p>
    </section>
    <section className="space-y-4"><h2 className="text-2xl font-semibold">Sources and data dates</h2>
      <p>The current scoring model uses the 2022 American Community Survey five-year estimates. Store locations and available addresses, hours and website links come from OpenStreetMap.</p>
      <p>Published store dataset: <time dateTime={datasetGeneratedAt() ?? undefined}>{datasetGeneratedAt()?.slice(0,10) ?? 'unavailable'}</time>. Refreshes are attempted weekly. If a source fails validation, the last complete published file stays in use; a schedule does not guarantee weekly updates.</p>
      <ul className="list-disc space-y-2 pl-5"><li><a className="underline" href="https://www.census.gov/data/developers/data-sets/acs-5year/2022.html">Census ACS 2022 data</a></li><li><a className="underline" href="https://www.openstreetmap.org/copyright">OpenStreetMap data and attribution</a></li><li><a className="underline" href="https://github.com/milock/thriftly/blob/main/lib/scoring.ts">Scoring implementation</a> and <a className="underline" href="https://github.com/milock/thriftly/blob/main/lib/reference-ranges.ts">reference ranges</a></li></ul>
    </section>
    <section className="space-y-4"><h2 className="text-2xl font-semibold">Use it to plan, then verify</h2><p>Coverage can miss stores or include outdated listings. Check the operator’s website before traveling. Inventory changes, and a neighborhood score cannot tell you what a store has today. Thriftly is an independent project and is not affiliated with Goodwill.</p><Link className="underline" href="/goodwill">Browse Goodwill locations by state</Link></section>
  </main><CityFooter/></div>;
}
