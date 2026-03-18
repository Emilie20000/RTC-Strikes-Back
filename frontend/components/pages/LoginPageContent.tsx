"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/http";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

export default function LoginPageContent() {
  const t = useTranslations('auth.login');
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setLocaleCookie = (locale: "fr" | "en") => {
    document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const data = await api<{ token: string; user: any }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      // Store session info
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      const persistedLocale = data.user?.langue;
      if (persistedLocale === "fr" || persistedLocale === "en") {
        setLocaleCookie(persistedLocale);
      }
      
      router.replace("/app");
    } catch (err: any) {
      console.error("Login error:", err);
       // Try to parse error message if it's a JSON string in the error object or just the message
       let msg = t('errorInvalid');
       try {
         if (err.message && err.message.startsWith("{")) {
             const parsed = JSON.parse(err.message);
             msg = parsed.error || msg;
         } else {
             msg = err.message || msg;
         }
       } catch (e) { /* ignore */ }
       
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="fixed right-4 top-4 z-50">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-2xl">{t('title')}</CardTitle>
          <CardDescription className="text-center">{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t('emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('emailPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('passwordLabel')}</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t('passwordPlaceholder')}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('submitLoading') : t('submit')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            {t('noAccount')}{" "}
            <Link href="/signup" className="text-primary hover:underline">
              {t('signupLink')}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
