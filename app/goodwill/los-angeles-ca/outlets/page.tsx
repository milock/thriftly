import Link from 'next/link';
import {pageMetadata,SITE_URL} from '@/lib/seo';
import {CityHeader,CityFooter} from '@/components/city/chrome';
import {JsonLd} from '@/components/json-ld';

export const metadata=pageMetadata('Goodwill outlets in Los Angeles: addresses & directions','Find the Los Angeles and Panorama City outlet locations listed by Goodwill Southern California. Get directions and check operator details before visiting.','/goodwill/los-angeles-ca/outlets');
const outlets=[
  {name:'Los Angeles Outlet, Atwater Village',address:'3150 N. San Fernando Rd., Los Angeles, CA 90065'},
  {name:'San Fernando Valley outlet',address:'14565 Lanark St., Panorama City, CA 91402'},
];
export default function LosAngelesOutlets() {
  return <div className="flex min-h-dvh flex-col"><CityHeader/><main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-5 py-12">
    <JsonLd data={{'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[
      {name:'Home',item:SITE_URL},{name:'Los Angeles Goodwill stores',item:SITE_URL+'/goodwill/los-angeles-ca'},{name:'Los Angeles outlets',item:SITE_URL+'/goodwill/los-angeles-ca/outlets'}
    ].map((x,i)=>({'@type':'ListItem',position:i+1,...x}))}}/>
    <nav aria-label="Breadcrumb"><Link href="/goodwill/los-angeles-ca" className="underline">Los Angeles Goodwill stores</Link> / Outlets</nav>
    <h1 className="text-4xl font-semibold tracking-tight">Goodwill outlets in Los Angeles</h1>
    <p className="text-lg">Looking for a Goodwill outlet, often called “the bins”? Start with these two Los Angeles-area locations listed on Goodwill Southern California’s outlet page.</p>
    <p className="text-sm text-muted-foreground">Source checked November 4, 2026. This is a selected operator-sourced guide, not a complete list of every outlet in the region.</p>
    <section className="space-y-5"><h2 className="text-2xl font-semibold">Addresses and directions</h2>{outlets.map(o=><article key={o.address} className="space-y-3 rounded-xl border border-border p-5"><h3 className="text-xl font-semibold">{o.name}</h3><p>{o.address}</p><a className="underline" href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(o.address)}>Get directions to {o.name}</a></article>)}</section>
    <section className="space-y-4"><h2 className="text-2xl font-semibold">Check the operator before leaving</h2><p>For current hours, prices and shopping rules, use <a className="underline" href="https://www.goodwillsocal.org/outlet-store/">Goodwill Southern California’s outlet page</a> and <a className="underline" href="https://www.goodwillsocal.org/shop/goodwill-locator/">official locator</a>. Local policies can change, and this guide does not promise today’s inventory or a particular price.</p></section>
    <section className="space-y-4"><h2 className="text-2xl font-semibold">Compare regular stores too</h2><p>The city guide lists mapped Goodwill locations with directions and neighborhood scores. Outlet merchandise and regular-store inventory can differ; the score does not predict what you will find at either.</p><div className="flex flex-wrap gap-5"><Link className="underline" href="/goodwill/los-angeles-ca">Compare Los Angeles Goodwill stores</Link><Link className="underline" href="/how-we-score">Understand the Goods Score</Link></div></section>
  </main><CityFooter/></div>;
}
