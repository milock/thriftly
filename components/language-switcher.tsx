"use client";

import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { usePathname } from "@/i18n/navigation";
import { localizedPath } from "@/i18n/routing";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

const languages = [
  ["en", "English"], ["es", "Español"], ["zh-Hans", "简体中文"],
  ["zh-Hant", "繁體中文"], ["tl", "Filipino"], ["vi", "Tiếng Việt"], ["ar", "العربية"],
] as const;

export function LanguageSwitcher() {
  const t = useTranslations("ui");
  const locale = useLocale();
  const pathname = usePathname();
  // Native selects can receive input before React attaches event handlers.
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <label title={t("language")} className="relative inline-flex size-11 shrink-0 items-center justify-center gap-1 rounded-md focus-within:ring-2 focus-within:ring-ring sm:w-auto sm:max-w-40 sm:border sm:border-border sm:px-2">
      <Languages className="size-4 shrink-0" aria-hidden />
      <span className="sr-only">{t("language")}</span>
      <select
        value={locale}
        disabled={!hydrated}
        aria-label={t("language")}
        className="absolute inset-0 size-full cursor-pointer opacity-0 sm:static sm:h-full sm:w-auto sm:min-w-0 sm:max-w-32 sm:bg-background sm:text-base sm:text-foreground sm:opacity-100 sm:outline-none"
        onChange={(event) => {
          // A document navigation keeps pending map history updates from canceling
          // the locale transition and applies the new document direction atomically.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Locale changes replace the document language/direction and must survive map history updates.
          window.location.assign(`${localizedPath(pathname, event.target.value)}${window.location.search}${window.location.hash}`);
        }}
      >
        {languages.map(([code, label]) => <option key={code} value={code} lang={code}>{label}</option>)}
      </select>
    </label>
  );
}
