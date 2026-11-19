import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { site } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: "Kairo Systems — AI automation for UK businesses", template: "%s · Kairo Systems" },
  description:
    "Kairo Systems designs, tests and runs AI receptionists, chatbots, lead capture, booking and CRM automations for UK businesses — so every enquiry is answered and followed up.",
  openGraph: { type: "website", siteName: "Kairo Systems", locale: "en_GB" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#050608", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
