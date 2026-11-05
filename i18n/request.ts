import {getRequestConfig} from 'next-intl/server';
import {isLocale} from './routing';

export default getRequestConfig(async (request) => {
  const requested = request.locale ?? await request.requestLocale;
  const locale = requested && isLocale(requested) ? requested : 'en';
  const [ui, pages] = await Promise.all([
    import(`../messages/ui/${locale}.json`).then(m => m.default),
    import(`../messages/pages/${locale}.json`).then(m => m.default),
  ]);
  return {locale, messages: {ui, pages}, timeZone: 'UTC'};
});
