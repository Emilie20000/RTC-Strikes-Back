"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const LOCALES = [
  { id: "fr", label: "FR" },
  { id: "en", label: "EN" },
] as const;

type Locale = (typeof LOCALES)[number]["id"];

function setLocaleCookie(locale: Locale) {
  // next-intl middleware reads NEXT_LOCALE by default
  document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function LanguageSwitcher() {
  const currentLocale = useLocale() as Locale;
  const router = useRouter();

  const current =
    LOCALES.find((l) => l.id === currentLocale) ??
    LOCALES.find((l) => l.id === "fr")!;

  const onSelect = (locale: Locale) => {
    if (locale === currentLocale) return;
    setLocaleCookie(locale);
    router.refresh();
    // Ensure server components re-render using the new locale
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {current.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((locale) => (
          <DropdownMenuItem key={locale.id} onClick={() => onSelect(locale.id)}>
            {locale.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
