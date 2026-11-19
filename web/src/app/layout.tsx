import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Schriften selbst ausgeliefert (Fontsource, SIL OFL 1.1); keine Anfrage an Google im Browser.
const interTight = localFont({
  variable: "--font-inter-tight",
  display: "swap",
  src: [
    { path: "../../node_modules/@fontsource/inter-tight/files/inter-tight-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/inter-tight/files/inter-tight-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/inter-tight/files/inter-tight-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../node_modules/@fontsource/inter-tight/files/inter-tight-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  display: "swap",
  src: [
    { path: "../../node_modules/@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/geist-mono/files/geist-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/geist-mono/files/geist-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.selectorz.art"),
  title: "Selectorz",
  description: "Show how you play. A DJ page that plays.",
  robots: { index: false, follow: false }, // bis zum Launch nicht indexieren
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${interTight.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
