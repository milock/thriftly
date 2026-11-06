"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Store } from "@/lib/types";
import { evidenceForStore } from "@/lib/store-evidence";
import { formatSourceDate, safeWebsiteUrl } from "@/lib/format";
import { StoreGoogleDetails } from "@/components/store-google-details";
import { ReportListing } from "@/components/report-listing";
import evidenceTranslations from "@/data/store-evidence-translations.json";

const translatedEvidence: Record<string, Record<string, {value?: string; caveat?: string}>> = evidenceTranslations;

const sourceNames: Record<string, string> = {
  "alltheplaces-goodwill": "All the Places · Goodwill locator",
  "alltheplaces-savers": "All the Places · Savers locator",
  "alltheplaces-buffalo-exchange": "All the Places · Buffalo Exchange locator",
  "official-salvation-army-locator": "Salvation Army locator",
  "official-out-of-the-closet-locator": "Out of the Closet locator",
};

/** Evidence is source-attributed. An import date never becomes a verified badge. */
export function ListingDetails({store, showType = true}: {store: Store; showType?: boolean}) {
  const t = useTranslations("listing");
  const u = useTranslations("ui");
  const locale = useLocale();
  const evidence = evidenceForStore(store);
  const source = store.provenance;
  const sourceUrl = safeWebsiteUrl(source?.sourceUrl);
  const date = (value?: string) => formatSourceDate(value, locale) ?? t("unknown");
  return <div className="space-y-2 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {showType && store.facilityType && <span>{u(store.facilityType)}</span>}
      <span>{t("source")}: {sourceUrl ? <a className="underline underline-offset-2" href={sourceUrl} target="_blank" rel="noopener noreferrer">{sourceNames[source!.source] ?? source!.source}</a> : source?.source ?? t("unknown")}</span>
    </div>
    <p>{t("checked")}: <time dateTime={source?.fetchedAt}>{date(source?.fetchedAt)}</time></p>
    <StoreGoogleDetails store={store} />
    <div className="flex flex-wrap items-start gap-x-4">
    <details className="min-w-0 [&[open]]:basis-full">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-foreground">{t("details")}</summary>
      <p className="mb-3">{t("sourceOnly")}</p>
      {source?.sourceUpdatedAt && <p className="mb-3">{t("sourceDate")}: <time dateTime={source.sourceUpdatedAt}>{date(source.sourceUpdatedAt)}</time></p>}
      {evidence.length ? <ul className="space-y-3">{evidence.map(e => {
        const translated = translatedEvidence[locale]?.[e.id];
        const value = typeof e.value === "number" ? new Intl.NumberFormat(locale, {numberingSystem: locale === "ar" ? "arab" : "latn"}).format(e.value) : translated?.value ?? String(e.value);
        return <li key={e.id}>
        <p className="font-medium text-foreground">{t(e.field)}{e.category === "practical" && <>: <bdi>{e.comparison === "greater_than" ? "> " : e.comparison === "approximately" ? "≈ " : ""}{value}{e.unit === "sq_ft" ? " ft²" : ""}</bdi></>}</p>
        {e.category === "department" && <p>{t("departmentNote")}</p>}
        {e.caveat && <p>{translated?.caveat ?? e.caveat}</p>}
        <p><a href={safeWebsiteUrl(e.source.url) ?? undefined} target="_blank" rel="noopener noreferrer" className="underline">{e.source.name}</a> · {t(e.source.kind === "official" ? "official" : "shopper")} · {t("checked")}: {date(e.observedAt)}</p>
        {"visitedAt" in e && <p>{t("visitDate")}: {date(e.visitedAt)}</p>}
      </li>})}</ul> : <p>{t("noEvidence")}</p>}
    </details>
    <ReportListing storeId={store.id} storeName={store.name} />
    </div>
  </div>;
}
