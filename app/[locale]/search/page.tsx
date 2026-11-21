import SearchPage from '@/components/search-page';
import {prepareInitialSearch} from '@/lib/initial-search';
import type {SearchParams} from '@/lib/search-query';

// Results depend on the request's coordinates, so the page renders per request.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default async function Page({searchParams}: {searchParams: Promise<SearchParams>}) {
  const initial = prepareInitialSearch(await searchParams);
  return <SearchPage key={JSON.stringify(initial.initialQuery)} {...initial} />;
}
