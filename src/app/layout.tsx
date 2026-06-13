import type { Metadata, Viewport } from "next";

import { Beacon } from "@/components/Beacon";
import { Header } from "@/components/Header";
import { UserStateProvider } from "@/hooks/useUserState";

import "./globals.css";

export const metadata: Metadata = {
  // metadataBase makes the opengraph-image resolve to an absolute URL, which
  // LinkedIn/Twitter/etc. require when scraping the share card.
  metadataBase: new URL("https://wc2026.alextestingstuff.com"),
  title: "WC26 Tracker",
  description:
    "Every FIFA World Cup 2026 match: live scores, group tables, stats, and SBS highlights. Never miss a goal.",
  openGraph: {
    title: "WC26 Tracker",
    description:
      "Every FIFA World Cup 2026 match: live scores, group tables, stats, and SBS highlights. Never miss a goal.",
    url: "https://wc2026.alextestingstuff.com",
    siteName: "WC26 Tracker",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WC26 Tracker",
    description:
      "Every FIFA World Cup 2026 match: live scores, group tables, stats, and SBS highlights. Never miss a goal.",
  },
};

export const viewport: Viewport = {
  themeColor: "#101418",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen font-sans">
        <UserStateProvider>
          <Beacon />
          <Header />
          <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
            {children}
          </main>
        </UserStateProvider>
      </body>
    </html>
  );
}
