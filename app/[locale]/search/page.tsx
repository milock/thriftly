import {headers} from 'next/headers';
import SearchPage from '@/components/search-page';
import {prepareInitialSearch} from '@/lib/initial-search';
import type {SearchParams} from '@/lib/search-query';

// Live Google content must never enter prerendered HTML or a CDN data cache.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default async function Page({searchParams}: {searchParams: Promise<SearchParams>}) {
  const initial = await prepareInitialSearch(await searchParams, {headers: await headers()});
  return <SearchPage key={JSON.stringify(initial.initialQuery)} {...initial} />;
}
