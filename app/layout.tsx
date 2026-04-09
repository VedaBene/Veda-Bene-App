import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veda Bene",
  description: "Gestione ordini di servizio per pulizie",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
