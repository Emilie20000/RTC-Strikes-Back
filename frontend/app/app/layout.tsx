"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);

  const getLocaleCookie = () => {
    const cookie = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("NEXT_LOCALE="));
    return cookie?.split("=")[1];
  };

  const setLocaleCookie = (locale: "fr" | "en") => {
    document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");

    if (!token) {
      router.replace("/login");
    } else if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUser(user);

        if (user?.langue === "fr" || user?.langue === "en") {
          const currentCookieLocale = getLocaleCookie();
          if (currentCookieLocale !== user.langue) {
            setLocaleCookie(user.langue);
            router.refresh();
          }
        }
      } catch (e) {
        console.error("Failed to parse user", e);
      }
    }
  }, [router, setCurrentUser]);

  return <>{children}</>;
}
