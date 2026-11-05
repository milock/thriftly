"use client";

import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";

const languages = [
  ["en", "English"], ["es", "Español"], ["zh-Hans", "简体中文"],
  ["zh-Hant", "繁體中文"], ["tl", "Filipino"], ["vi", "Tiếng Việt"], ["ar", "العربية"],
] as const;

export function LanguageSwitcher() {
  const t = useTranslations("ui");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <label className="relative inline-flex h-9 max-w-40 shrink-0 items-center gap-1 rounded-md border border-border px-2 focus-within:ring-2 focus-within:ring-ring">
      <Languages className="size-4 shrink-0" aria-hidden />
      <span className="sr-only">{t("language")}</span>
      <select
        value={locale}
        aria-label={t("language")}
        className="h-full min-w-0 max-w-32 cursor-pointer bg-background text-base text-foreground outline-none"
        onChange={(event) => router.replace(`${pathname}${window.location.search}${window.location.hash}`, { locale: event.target.value as typeof languages[number][0], scroll: false })}
      >
        {languages.map(([code, label]) => <option key={code} value={code} lang={code}>{label}</option>)}
      </select>
    </label>
  );
}
