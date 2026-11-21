import {useTranslations} from 'next-intl';
import {ExternalLink} from 'lucide-react';
import type {Store} from '@/lib/types';
import {mapsPlaceUrl} from '@/lib/format';

/** A plain Google Maps link. Opening it costs nothing and loads no Google API. */
export function StoreReviewsLink({store}: {store: Store}) {
  const t = useTranslations('directory');
  return <a data-google-reviews data-store-id={store.id} href={mapsPlaceUrl(store)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
    {t('readGoogleReviews')}<ExternalLink aria-hidden="true" className="size-3.5" />
  </a>;
}
