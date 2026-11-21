import {getRequestConfig} from 'next-intl/server';
import {isLocale} from './routing';

export default getRequestConfig(async (request) => {
  const requested = request.locale ?? await request.requestLocale;
  const locale = requested && isLocale(requested) ? requested : 'en';
  const [ui, pages, directory, listing, reports, legal] = await Promise.all([
    import(`../messages/ui/${locale}.json`).then(m => m.default),
    import(`../messages/pages/${locale}.json`).then(m => m.default),
    import(`../messages/directory/${locale}.json`).then(m => m.default),
    import(`../messages/listing/${locale}.json`).then(m => m.default),
    import(`../messages/reports/${locale}.json`).then(m => m.default),
    import(`../messages/legal/${locale}.json`).then(m => m.default),
  ]);
  return {locale, messages: {ui, pages, directory, listing, reports, legal}, timeZone: 'UTC'};
});
