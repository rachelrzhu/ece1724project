import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Savor | Recipe sharing", template: "%s | Savor" },
  description: "Discover, share, and scale recipes to your servings or available ingredients.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
