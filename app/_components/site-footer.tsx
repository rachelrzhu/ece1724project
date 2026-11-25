import { appName } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line py-5 text-center text-sm text-subtle">
      © {new Date().getUTCFullYear()} {appName}
    </footer>
  );
}
