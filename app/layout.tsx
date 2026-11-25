import type { Metadata } from "next";
import { SiteFooter } from "./_components/site-footer";
import { appName } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: appName,
  title: { default: `${appName} | Recipe sharing`, template: `%s | ${appName}` },
  description: "Share recipes from your kitchen and adjust them for the people at your table.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex flex-col">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
