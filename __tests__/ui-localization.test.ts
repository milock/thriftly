import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScoreRing } from "@/components/score-ring";
import { ScoreBreakdown } from "@/components/score-breakdown";
import { RankedStores } from "@/components/city/ranked-stores";
import type { ScoredStore } from "@/lib/types";
import { NextIntlClientProvider, createTranslator } from "next-intl";
import { readFileSync } from "node:fs";
import { formatCurrency, formatDistance } from "@/lib/format";

const locales = ["en", "es", "zh-Hans", "zh-Hant", "tl", "vi", "ar"];
const catalogs = Object.fromEntries(locales.map((locale) => [locale, JSON.parse(readFileSync(`messages/ui/${locale}.json`, "utf8"))]));
const widgetMessages = (locale: string) => Object.fromEntries(
  ["ui", "listing", "directory", "reports"].map(namespace => [namespace, JSON.parse(readFileSync(`messages/${namespace}/${locale}.json`, "utf8"))]),
);
describe("UI locale catalogs", () => {
  it.each(locales)("%s has complete catalogs and valid plural messages", (locale) => {
    expect(Object.keys(catalogs[locale]).sort()).toEqual(Object.keys(catalogs.en).sort());
    const failures: unknown[] = [];
    const t = createTranslator({ locale, messages: catalogs[locale], onError: (error) => failures.push(error) });
    for (const count of [0, 1, 2, 3, 11, 100]) {
      for (const key of ["results", "resultsNear", "tracts", "residents"]) expect(t(key, { count, place: "San Diego" })).toBeTruthy();
    }
    expect(failures).toEqual([]);
  });
  it("uses explicit locales while retaining USD and miles", () => {
    expect(formatCurrency(1000, {locale:"en"})).toBe("$1,000");
    expect(formatCurrency(1000, {locale:"es"})).toContain("US$");
    expect(formatDistance(2.5, "es")).toMatch(/2,5\smi/);
    expect(formatDistance(2.5, "zh-Hant")).toBe("2.5英里");
    expect(formatDistance(2.5, "vi")).toBe("2,5 dặm");
  });
});


it.each(locales)("renders score widgets with the %s provider", (locale) => {
  const unscored: ScoredStore = { id: "test", name: "Goodwill", location: { lat: 32, lon: -117 }, distanceMiles: 1, score: { total: 0, catchment: { tractCount: 0, population: 0 }, factors: {} as ScoredStore["score"]["factors"] } };
  // The provider requires children in its props type for this non-JSX test.
  // eslint-disable-next-line react/no-children-prop
  const html = renderToStaticMarkup(createElement(NextIntlClientProvider, { locale, messages: widgetMessages(locale), onError: error => {throw error;}, timeZone: "UTC", children: createElement("div", null,
    createElement(ScoreRing, {score: 75}),
    createElement(ScoreBreakdown, {score: unscored.score}),
    createElement(RankedStores, {stores:[unscored], cityName:"San Diego"}),
  ) }));
  expect(html).toContain(catalogs[locale].notScored);
  expect(html).toContain(catalogs[locale].directions);
  expect(html).not.toContain("ui.");
});
