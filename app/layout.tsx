import type { Metadata } from "next";
import localFont from "next/font/local";
import { appName } from "@/lib/brand";
import "./globals.css";

const newsreader = localFont({
  src: [
    { path: "./_fonts/newsreader-latin-standard-normal.woff2", weight: "200 800", style: "normal" },
    { path: "./_fonts/newsreader-latin-standard-italic.woff2", weight: "200 800", style: "italic" },
  ],
  variable: "--font-newsreader",
  display: "swap",
  preload: false,
  fallback: ["Georgia"],
});

export const metadata: Metadata = {
  applicationName: appName,
  title: { default: `${appName} | Recipe sharing`, template: `%s | ${appName}` },
  description: "Share recipes from your kitchen and adjust them for the people at your table.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={newsreader.variable}>
      <body>{children}</body>
    </html>
  );
}
