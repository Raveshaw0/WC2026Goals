import type { Metadata, Viewport } from "next";

import { Header } from "@/components/Header";
import { UserStateProvider } from "@/hooks/useUserState";

import "./globals.css";

export const metadata: Metadata = {
  title: "WC26 Tracker",
  description: "Personal FIFA World Cup 2026 tracker",
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
          <Header />
          <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
            {children}
          </main>
        </UserStateProvider>
      </body>
    </html>
  );
}
