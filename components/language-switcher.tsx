"use client";

import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { usePathname } from "@/i18n/navigation";
import { isLocale, locales, localeNames, localizedPath } from "@/i18n/routing";
import { useSyncExternalStore } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DirectionProvider } from "@base-ui/react/direction-provider";

const subscribe = () => () => {};

const languages = locales.map(value => ({value, label: localeNames[value]}));

export function LanguageSwitcher() {
  const t = useTranslations("ui");
  const locale = useLocale();
  const pathname = usePathname();
  // Keep the first server/client render identical and wait for navigation handlers.
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <DirectionProvider direction={locale === "ar" ? "rtl" : "ltr"}>
    <Select
      value={locale}
      items={languages}
      disabled={!hydrated}
      modal={false}
      onValueChange={(value) => {
          if (!value || !isLocale(value) || value === locale) return;
          // A document navigation keeps pending map history updates from canceling
          // the locale transition and applies the new document direction atomically.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Locale changes replace the document language/direction and must survive map history updates.
          window.location.assign(`${localizedPath(pathname, value)}${window.location.search}${window.location.hash}`);
      }}
    >
      <SelectTrigger
        data-language-picker
        title={t("language")}
        aria-label={t("language")}
        className="size-11 shrink-0 justify-center gap-2 rounded-md border-transparent px-0 text-sm hover:bg-muted data-[size=default]:h-11 sm:w-auto sm:max-w-44 sm:border-border sm:px-3 [&>svg:last-child]:hidden sm:[&>svg:last-child]:block"
      >
        <Languages className="size-4 text-muted-foreground" aria-hidden />
        <span className="hidden min-w-0 sm:block"><SelectValue /></span>
      </SelectTrigger>
      <SelectContent
        align="end"
        sideOffset={8}
        alignItemWithTrigger={false}
        aria-label={t("language")}
        className="w-56 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl p-1.5 shadow-lg ring-0 data-open:animate-none data-closed:animate-none"
        listClassName="max-h-[calc(var(--available-height)-0.75rem)] scroll-py-6 overflow-y-auto overscroll-contain"
      >
        {languages.map(({value, label}) => <SelectItem
          key={value}
          value={value}
          label={label}
          className="min-h-11 cursor-pointer rounded-md ps-3 pe-9 text-sm data-highlighted:bg-accent data-selected:font-medium"
        >
          <bdi lang={value} dir={value === "ar" ? "rtl" : "ltr"}>{label}</bdi>
        </SelectItem>)}
      </SelectContent>
    </Select>
    </DirectionProvider>
  );
}
