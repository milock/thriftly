import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {BRANDS, storeBrandId} from '@/lib/brands';
import {cityCentroid} from '@/lib/city-data';
import type {City} from '@/lib/cities';
import {locateBundledStores} from '@/lib/locate';

export async function BrandNavigation({city, active}: {city: City; active: string}) {
  const t = await getTranslations('directory');
  const center = cityCentroid(city.slug);
  const stores = center ? locateBundledStores(center, city.radiusMiles) : [];
  const choices = [
    {id: 'thrift-stores', name: t('allStores'), count: stores.length},
    ...BRANDS.map(brand => ({id: brand.id, name: brand.name, count: stores.filter(store => storeBrandId(store) === brand.id).length})),
  ];
  return <nav aria-label={t('cityBrands', {city: city.city})} className="mt-8">
    <h2 className="text-sm font-semibold">{t('cityBrands', {city: city.city})}</h2>
    <div className="mt-3 flex flex-wrap gap-2">
      {choices.filter(choice => choice.count > 0 || choice.id === active).map(choice =>
        <Link key={choice.id} href={`/${choice.id}/${city.slug}`} aria-current={choice.id === active ? 'page' : undefined}
          className="rounded-full border border-border px-3 py-2 text-sm hover:border-foreground aria-[current=page]:border-foreground aria-[current=page]:font-semibold">
          {choice.name} <span className="tabular text-muted-foreground">({choice.count})</span>
        </Link>)}
    </div>
  </nav>;
}
