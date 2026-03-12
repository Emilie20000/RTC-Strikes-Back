import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SocketManager } from "@/providers/SocketManager";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        <SocketManager />
        {children}
        <Toaster position="bottom-right" theme="dark" />
      </body>
    </html>
  );
}
