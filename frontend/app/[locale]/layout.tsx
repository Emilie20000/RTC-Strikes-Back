import {setRequestLocale, getMessages} from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { Toaster } from "@/components/ui/sonner";
import { SocketManager } from "@/providers/SocketManager";

export function generateStaticParams() {
  return [{locale: 'en'}, {locale: 'fr'}];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SocketManager />
          {children}
          <Toaster position="bottom-right" theme="dark" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
