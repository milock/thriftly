"use client";

import { ListChecks } from "lucide-react";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Store } from "@/lib/types";
import { evidenceForStore } from "@/lib/store-evidence";
import { hasOnlineVerification } from "@/lib/independent-stores";
import { formatSourceDate, safeWebsiteUrl } from "@/lib/format";
import { StoreGoogleDetails } from "@/components/store-google-details";
import { InfoDisclosure } from "@/components/info-disclosure";
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
export function ListingDetails({store, actions}: {store: Store; actions?: ReactNode}) {
  const t = useTranslations("listing");
  const u = useTranslations("ui");
  const locale = useLocale();
  const evidence = evidenceForStore(store);
  const source = store.provenance;
  const sourceUrl = safeWebsiteUrl(source?.sourceUrl);
  const date = (value?: string) => formatSourceDate(value, locale, store.timezone) ?? t("unknown");
  return <div className="text-xs leading-relaxed text-muted-foreground">
    <StoreGoogleDetails store={store} />
    <div className="flex flex-wrap items-center gap-x-1">
      {actions}
      <InfoDisclosure label={t("listingInfo")}>
        {store.facilityType && <p>{u(store.facilityType)}</p>}
        {store.operatorType === "independent" && <p>{t("independent")}</p>}
        {store.registryIdentity && <p>{t("registryListing")}: <bdi>{store.registryIdentity.name}</bdi>{store.registryIdentity.address && <> · <bdi dir="ltr">{store.registryIdentity.address}</bdi></>}</p>}
        <p>{t("source")}: {sourceUrl ? <a className="underline underline-offset-2" href={sourceUrl} target="_blank" rel="noopener noreferrer">{source?.source === "official-independent-website" ? t("operatorWebsite") : sourceNames[source!.source] ?? source!.source}</a> : source?.source ?? t("unknown")}</p>
        <p>{t("retrieved")}: <time dateTime={source?.fetchedAt}>{date(source?.fetchedAt)}</time></p>
        {source?.sourceUpdatedAt && <p>{t("sourceDate")}: <time dateTime={source.sourceUpdatedAt}>{date(source.sourceUpdatedAt)}</time></p>}
        {hasOnlineVerification(store) ? <><p className="font-medium text-foreground">{t("verifiedOnline", {date: date(store.verification!.checkedAt)})}</p><p>{t("verificationMethod")}</p></> : <p>{t("sourceOnly")}</p>}
      </InfoDisclosure>
      {evidence.length > 0 && <InfoDisclosure label={t("details")} icon={<ListChecks className="size-4" aria-hidden />}>
        <ul className="space-y-2">{evidence.map(e => {
          const translated = translatedEvidence[locale]?.[e.id];
          const value = typeof e.value === "number" ? new Intl.NumberFormat(locale, {numberingSystem: locale === "ar" ? "arab" : "latn"}).format(e.value) : translated?.value ?? String(e.value);
          return <li key={e.id} className="flex items-center gap-1">
            <div><p className="font-medium text-foreground">{t(e.field)}{e.category === "practical" && <>: <bdi>{e.comparison === "greater_than" ? "> " : e.comparison === "approximately" ? "≈ " : ""}{value}{e.unit === "sq_ft" ? " ft²" : ""}</bdi></>}</p>{e.category === "department" && <p>{t("departmentNote")}</p>}{e.caveat && <p>{translated?.caveat ?? e.caveat}</p>}</div>
            <InfoDisclosure label={t("evidenceInfo", {field: t(e.field)})}><p><a href={safeWebsiteUrl(e.source.url) ?? undefined} target="_blank" rel="noopener noreferrer" className="underline">{e.source.name}</a> · {t("official")} · {t("checked")}: {date(e.observedAt)}</p></InfoDisclosure>
          </li>;
        })}</ul>
      </InfoDisclosure>}
      <ReportListing storeId={store.id} storeName={store.name} />
    </div>
  </div>;
}
