'use client';
import {useContext, useEffect, useRef} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Star, RotateCw, ExternalLink} from 'lucide-react';
import type {Store} from '@/lib/types';
import {LiveStoresContext} from '@/lib/use-live-stores';
import {mapsPlaceUrl} from '@/lib/format';
import {InfoDisclosure} from '@/components/info-disclosure';

/** Direct server ratings never wait for Maps JavaScript. */
export function StoreGoogleDetails({store}: {store: Store}) {
  const t = useTranslations('directory'), ui = useTranslations('ui');
  const locale = useLocale();
  const live = useContext(LiveStoresContext);
  const target = useRef<HTMLDivElement>(null);
  const request = live?.request;
  useEffect(() => {
    if (!target.current || !request) return;
    if (typeof IntersectionObserver === 'undefined') { request(store.id, 0); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { request(store.id, 0); observer.disconnect(); }
    }, {rootMargin: '120px'});
    observer.observe(target.current);
    return () => observer.disconnect();
  }, [request, store.id]);
  const record = live?.records.get(store.id);
  const google = store.google ?? record?.google;
  const status = google ? 'loaded' : record?.status ?? (store.googlePlaceId && live ? 'queued' : 'unavailable');
  const nf = new Intl.NumberFormat(locale, {maximumFractionDigits: 1, numberingSystem: locale === 'ar' ? 'arab' : 'latn'});
  const url = google?.mapsUrl ?? mapsPlaceUrl(store);
  return <div ref={target} data-google-rating data-store-id={store.id} data-state={status} className="flex min-h-11 flex-wrap items-center gap-x-2 text-sm">
    {status === 'loaded' && google ? <>
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={google.rating === null ? t('noReviews') : `${t('googleRating', {rating: nf.format(google.rating)})}, ${t('reviewCount', {count: google.ratingCount ?? 0})}`}>
        <Star aria-hidden="true" className="size-3.5 fill-amber-500 text-amber-600 dark:text-amber-400" />
        <span className="font-medium tabular-nums text-foreground">{google.rating === null ? '—' : nf.format(google.rating)}</span>
        <span className="tabular-nums text-muted-foreground">({nf.format(google.ratingCount ?? 0)})</span>
        <span translate="no" className="ms-1 whitespace-nowrap text-xs font-normal not-italic tracking-normal text-[#5e5e5e] dark:text-white">Google Maps</span>
      </a>
      <InfoDisclosure label={t('ratingDetails')}>
        <p>{google.rating === null ? t('noReviews') : t('googleRating', {rating: nf.format(google.rating)})}</p>
        <p>{t('reviewCount', {count: google.ratingCount ?? 0})}</p><p>{t('ratingSeparate')}</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 underline underline-offset-2">{t('readGoogleReviews')}<ExternalLink aria-hidden="true" className="size-3" /></a>
      </InfoDisclosure>
      {google.attributions.map((item, index) => <span key={index} className="text-xs text-muted-foreground">{item.providerUri ? <a href={item.providerUri} target="_blank" rel="noopener noreferrer" className="underline">{item.provider}</a> : item.provider}</span>)}
    </> : status === 'unavailable' ? <>
      <span className="text-xs text-muted-foreground">{t('ratingUnavailable')}</span>
      <button type="button" aria-label={ui('retry')} onClick={() => request?.(store.id, -1, true)} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"><RotateCw aria-hidden="true" className="size-3.5" /></button>
    </> : <span role="status" aria-label={t('loadingReviews')} className="inline-flex h-4 w-36 animate-pulse rounded bg-muted motion-reduce:animate-none" />}
  </div>;
}
