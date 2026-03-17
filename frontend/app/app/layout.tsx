"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");

    if (!token) {
      router.replace("/login");
    } else if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
      } catch (e) {
        console.error("Failed to parse user", e);
      }
    }
  }, [router, setCurrentUser]);

  return (
    <div className="relative">
      <div className="absolute right-2 top-2 z-50">
        <LanguageSwitcher />
      </div>
      {children}
    </div>
  );
}
