import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SocketManager } from "@/providers/SocketManager";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
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
