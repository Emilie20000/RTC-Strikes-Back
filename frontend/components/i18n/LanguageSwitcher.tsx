"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/http";
import { useAppStore, type User } from "@/lib/store";

const LOCALES = [
  { id: "fr", label: "🇫🇷" },
  { id: "en", label: "🇬🇧" },
] as const;

type Locale = (typeof LOCALES)[number]["id"];

function setLocaleCookie(locale: Locale) {
  // next-intl middleware reads NEXT_LOCALE by default
  document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function LanguageSwitcher() {
  const currentLocale = useLocale() as Locale;
  const router = useRouter();
  const currentUser = useAppStore((s) => s.currentUser);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);

  const onSelect = async (locale: Locale) => {
    if (locale === currentLocale) return;

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      try {
        const updatedUser = await api<User>("/api/users/me", {
          method: "PATCH",
          body: JSON.stringify({ langue: locale }),
        });

        const mergedUser = currentUser ? { ...currentUser, ...updatedUser } : updatedUser;
        setCurrentUser(mergedUser);
        localStorage.setItem("user", JSON.stringify(mergedUser));
      } catch (e) {
        console.error("Failed to persist language preference", e);
      }
    }

    setLocaleCookie(locale);
    router.refresh();
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-1">
      {LOCALES.map((locale) => {
        const isActive = locale.id === currentLocale;
        return (
          <Button
            key={locale.id}
            type="button"
            size="sm"
            variant={isActive ? "default" : "outline"}
            onClick={() => onSelect(locale.id)}
            aria-label={locale.id === "fr" ? "Français" : "English"}
          >
            {locale.label}
          </Button>
        );
      })}
    </div>
  );
}
