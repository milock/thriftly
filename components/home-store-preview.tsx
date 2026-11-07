'use client';
import {useTranslations} from 'next-intl';
import {ArrowUpRight} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import type {ScoredStore} from '@/lib/types';
import {LiveStoresContext, useLiveStores} from '@/lib/use-live-stores';
import {hasNeighborhoodBaseline} from '@/lib/scoring';
import {ScoreDetails} from '@/components/score-details';
import {StoreGoogleDetails} from '@/components/store-google-details';
export function HomeStorePreview({stores}: {stores: ScoredStore[]}) {
  const t=useTranslations('ui'), l=useTranslations('listing');
  const live=useLiveStores(stores, null, {lat:32.7157,lon:-117.1611},15);
  return <LiveStoresContext.Provider value={live.context}><div className="overflow-hidden rounded-xl border bg-card">
    <div className="border-b px-4 py-3 text-xs font-medium text-muted-foreground">{l('previewLocation',{place:'San Diego, CA'})}</div>
    <ol className="divide-y divide-border">{[...live.stores].sort((a,b)=>b.score.total-a.score.total).map(store=><li key={store.id} className="p-4 sm:px-5">
      <div className="flex items-start gap-3"><div className="min-w-0 flex-1">
        <Link href={`/search?lat=32.7157&lon=-117.1611&radius=15&label=San+Diego&sel=${encodeURIComponent(store.id)}`} className="inline-flex min-h-11 items-center gap-2 font-semibold leading-tight underline-offset-4 hover:underline"><bdi>{store.name}</bdi><ArrowUpRight className="size-4 shrink-0" aria-hidden /></Link>
        <p className="text-xs leading-relaxed text-muted-foreground"><bdi>{store.google?.address ?? store.street ?? store.address}</bdi></p>
      </div>{hasNeighborhoodBaseline(store.score)?<ScoreDetails score={store.score}/>:<span className="flex size-14 items-center justify-center text-2xl text-muted-foreground" aria-label={t("notScored")}>—</span>}</div>
      <StoreGoogleDetails store={store}/>
    </li>)}</ol>
  </div></LiveStoresContext.Provider>;
}
